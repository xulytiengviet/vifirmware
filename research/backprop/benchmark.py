#!/usr/bin/env python3
"""Experimental CVNSS4.0 candidate-lattice benchmark: bigram Viterbi vs tiny GRU.

Expected INPUT: three audited JSONL sets, one sentence per line:
{"id":"doc-01-s1","tokens":[{"code":"FAIZ","candidates":["phải"],"gold":"phải"}]}

A *real* experiment needs ambiguous tokens and candidates validated against a
version-locked CVNSS4.0 encoder. This script intentionally DOES NOT invent
linguistic alternatives or claim any measured ESP32-S3 result.

Install: pip install torch
Usage: python research/backprop/benchmark.py --train train.jsonl --dev dev.jsonl --test test.jsonl --out result.json
"""
import argparse
import collections
import copy
import json
import math
import random
import unicodedata
from pathlib import Path

try:
    import torch
    from torch import nn
    from torch.nn import functional as F
except ImportError as exc:
    raise SystemExit("PyTorch required on the training host: python -m pip install torch") from exc


def read_jsonl(path):
    sentences, seen = [], set()
    for line_number, line in enumerate(Path(path).read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            obj = json.loads(line)
            sid = obj.get("id")
            tokens = obj["tokens"]
            if not isinstance(sid, str) or not sid or sid in seen:
                raise ValueError("missing/duplicate id")
            seen.add(sid)
            if not isinstance(tokens, list) or not tokens:
                raise ValueError("empty tokens")
            for token in tokens:
                code = token["code"]
                candidates = token["candidates"]
                gold = token["gold"]
                if not isinstance(code, str) or not code or any(c not in " ABCDEFGHIJKLMNOPQRSTUVWXYZ" for c in code):
                    raise ValueError("CODE must be ASCII A-Z or SPACE, nonempty")
                if not isinstance(candidates, list) or not candidates or not all(isinstance(x, str) and x for x in candidates):
                    raise ValueError("missing Unicode candidates")
                if len(set(candidates)) != len(candidates) or gold not in candidates:
                    raise ValueError("candidates duplicated or gold not present")
                if any(unicodedata.normalize("NFC", x) != x for x in candidates):
                    raise ValueError("candidates must be NFC")
            sentences.append(obj)
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
            raise ValueError("%s:%d: %s" % (path, line_number, exc)) from exc
    if not sentences:
        raise ValueError("Empty input: " + str(path))
    return sentences


def read_and_check_splits(paths):
    datasets = [read_jsonl(p) for p in paths]
    ids = [set(s["id"] for s in data) for data in datasets]
    for i in range(3):
        for j in range(i + 1, 3):
            if ids[i] & ids[j]:
                raise ValueError("Train/dev/test sentence ids overlap")
    return datasets


class ViterbiBigram:
    """Smoothed bigram path decoder on the provided candidate lattice."""

    def __init__(self, train):
        self.bigrams = collections.Counter()
        self.previous = collections.Counter()
        self.vocab = set()
        for sent in train:
            previous = "<BOS>"
            for token in sent["tokens"]:
                word = token["gold"]
                self.vocab.add(word)
                self.bigrams[(previous, word)] += 1
                self.previous[previous] += 1
                previous = word
        self.alpha = 0.5
        self.bins = len(self.vocab) + 1

    def transition(self, before, word):
        return math.log(
            (self.bigrams[(before, word)] + self.alpha)
            / (self.previous[before] + self.alpha * self.bins)
        )

    def predict(self, tokens):
        paths = {"<BOS>": (0.0, [])}
        for tok in tokens:
            new_paths = {}
            for current in tok["candidates"]:
                options = [
                    (score + self.transition(previous, current), path + [current])
                    for previous, (score, path) in paths.items()
                ]
                new_paths[current] = max(options, key=lambda item: item[0])
            paths = new_paths
        return max(paths.values(), key=lambda item: item[0])[1]


class TinyGRU(nn.Module):
    """Small context GRU + Unicode-hash candidate embeddings.

    Character hashing supports previously unseen candidates but can collide.
    This reference model predicts position-wise candidate probabilities, not
    a globally optimal candidate path; do not equate its search with Viterbi.
    """

    def __init__(self, embed_dim=24, hidden_dim=48, candidate_bins=4096):
        super().__init__()
        self.code_embedding = nn.Embedding(28, embed_dim)
        self.gru = nn.GRU(embed_dim, hidden_dim, batch_first=True)
        self.candidate_embedding = nn.Embedding(candidate_bins, hidden_dim)
        self.hidden_dim = hidden_dim
        self.candidate_bins = candidate_bins

    def code_vector(self, code):
        ids = [1 if char == " " else 2 + ord(char) - ord("A") for char in code]
        return self.code_embedding(torch.tensor(ids, dtype=torch.long)).mean(dim=0)

    def candidate_vector(self, word):
        ids = [1 + (ord(char) % (self.candidate_bins - 1)) for char in word]
        return self.candidate_embedding(torch.tensor(ids, dtype=torch.long)).mean(dim=0)

    def forward(self, tokens):
        sequence = torch.stack([self.code_vector(tok["code"]) for tok in tokens]).unsqueeze(0)
        states, _ = self.gru(sequence)
        output = []
        for state, token in zip(states[0], tokens):
            vectors = torch.stack([self.candidate_vector(word) for word in token["candidates"]])
            output.append((vectors @ state) / math.sqrt(self.hidden_dim))
        return output

    def predict(self, tokens):
        with torch.no_grad():
            logits = self.forward(tokens)
        return [token["candidates"][int(scores.argmax())] for token, scores in zip(tokens, logits)]


def edit_distance(a, b):
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i] + [0] * len(b)
        for j, y in enumerate(b, 1):
            cur[j] = min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + (x != y))
        prev = cur
    return prev[-1]


def metrics(data, predictor, train_vocab):
    n = correct = amb = amb_correct = oov = oov_correct = exact = chars = edits = 0
    for sent in data:
        tokens = sent["tokens"]
        prediction = predictor(tokens)
        if len(prediction) != len(tokens):
            raise AssertionError("Wrong prediction length")
        gold = [t["gold"] for t in tokens]
        exact += int(prediction == gold)
        expected_str = " ".join(gold)
        predicted_str = " ".join(prediction)
        chars += len(expected_str)
        edits += edit_distance(expected_str, predicted_str)
        for tok, guess in zip(tokens, prediction):
            if guess not in tok["candidates"]:
                raise AssertionError("Candidate constraint violated")
            ok = int(guess == tok["gold"])
            n += 1
            correct += ok
            if len(tok["candidates"]) > 1:
                amb += 1
                amb_correct += ok
            if tok["gold"] not in train_vocab:
                oov += 1
                oov_correct += ok
    return {
        "sentences": len(data),
        "tokens": n,
        "ambiguous_tokens": amb,
        "oov_tokens": oov,
        "token_accuracy": correct / n,
        "ambiguous_accuracy": amb_correct / amb if amb else None,
        "oov_accuracy": oov_correct / oov if oov else None,
        "sentence_exact": exact / len(data),
        "cer_approx_joined_tokens": edits / chars if chars else None,
        "token_error_rate": (n - correct) / n,
    }


def fit_gru(train, dev, train_vocab, epochs, seed, lr, embed_dim, hidden_dim):
    torch.manual_seed(seed)
    torch.set_num_threads(1)
    model = TinyGRU(embed_dim, hidden_dim)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr)
    rng = random.Random(seed)
    best_score = -1.0
    best_model = copy.deepcopy(model.state_dict())
    history = []
    for epoch in range(1, epochs + 1):
        order = list(range(len(train)))
        rng.shuffle(order)
        losses = []
        model.train()
        for index in order:
            tokens = train[index]["tokens"]
            ambiguous = [i for i, tok in enumerate(tokens) if len(tok["candidates"]) > 1]
            if not ambiguous:
                continue
            logits = model(tokens)
            loss = torch.stack([
                F.cross_entropy(logits[i].unsqueeze(0),
                                torch.tensor([tokens[i]["candidates"].index(tokens[i]["gold"])]))
                for i in ambiguous
            ]).mean()
            optimizer.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            losses.append(float(loss.detach()))
        model.eval()
        dev_report = metrics(dev, model.predict, train_vocab)
        criterion = dev_report["ambiguous_accuracy"]
        if criterion is None:
            criterion = dev_report["token_accuracy"]
        if criterion > best_score:
            best_score = criterion
            best_model = copy.deepcopy(model.state_dict())
        history.append({"epoch": epoch, "training_loss": sum(losses) / len(losses) if losses else None,
                        "dev_ambiguous_accuracy": dev_report["ambiguous_accuracy"],
                        "dev_token_accuracy": dev_report["token_accuracy"]})
        print("epoch=%d train_loss=%s dev_ambig=%s" %
              (epoch, "%.5f" % history[-1]["training_loss"] if losses else "N/A",
               str(dev_report["ambiguous_accuracy"])))
    model.load_state_dict(best_model)
    model.eval()
    return model, history


def main():
    parser = argparse.ArgumentParser(description="Audited CVNSS4.0 lattice benchmark: Viterbi versus GRU.")
    parser.add_argument("--train", required=True)
    parser.add_argument("--dev", required=True)
    parser.add_argument("--test", required=True)
    parser.add_argument("--out", default="backprop-results.json")
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--lr", type=float, default=0.001)
    parser.add_argument("--embed", type=int, default=24)
    parser.add_argument("--hidden", type=int, default=48)
    args = parser.parse_args()
    if args.epochs < 1 or args.embed < 1 or args.hidden < 1:
        parser.error("--epochs, --embed, --hidden must be positive")
    train, dev, test = read_and_check_splits([args.train, args.dev, args.test])
    ambiguous_training = sum(len(t["candidates"]) > 1 for s in train for t in s["tokens"])
    if not ambiguous_training:
        raise SystemExit("No genuinely ambiguous training tokens; GRU disambiguation cannot be evaluated.")
    vocab = set(t["gold"] for s in train for t in s["tokens"])
    viterbi = ViterbiBigram(train)
    model, hist = fit_gru(train, dev, vocab, args.epochs, args.seed, args.lr, args.embed, args.hidden)
    report = {
        "status": "COMPUTED_ON_USER_SUPPLIED_CORPUS_NOT_HARDWARE",
        "caveat": "Lattice and gold require external CVNSS4.0 version-locked re-encoding audit.",
        "seed": args.seed,
        "train_sentences": len(train), "dev_sentences": len(dev), "test_sentences": len(test),
        "ambiguous_train_tokens": ambiguous_training,
        "gru_parameter_count": sum(p.numel() for p in model.parameters()),
        "baseline_viterbi_bigram": metrics(test, viterbi.predict, vocab),
        "gru_independent_candidate_ranking": metrics(test, model.predict, vocab),
        "training_history": hist,
        "device": "CPU_HOST_ONLY",
        "no_claims": ["ESP32-S3 throughput", "ternary speedup", "statistical superiority", "universal exact Unicode reconstruction"],
    }
    Path(args.out).write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("Saved measured corpus results to", args.out)
    print("Do not claim advantage without source-separated test and confidence intervals.")


if __name__ == "__main__":
    main()
