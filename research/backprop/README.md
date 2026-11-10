# CVNSS4.0 × Rule-Constrained Backpropagation — research protocol

**Status (2026-11-10): reproducible research design, not an accepted paper or a measured neural/ESP32-S3 result.**

- [Research article / web lab](../../docs/backprop-paper.html)
- [Native ESP32-S3 lab](../../docs/native-lab.html)
- [VF1 specification](../../spec/VF1.md)
- [Existing native C++ codec](../../native/)
- [Existing independent portable VF1 transports](../../portable/)

## Research question

Can a small context-aware GRU rank *valid* CVNSS4.0 Unicode decoding candidates better than an n-gram/Viterbi decoder, under identical candidate lattices, dataset splits and evaluation budgets?

The fixed CVNSS4.0 v5 reference engine is not differentiable and is **not** trained. A neural candidate scorer is trained only on decisions inside its valid candidate set.

## Mathematical contract

Given NFC Unicode input x and a fixed, versioned encoder E, let c=E(x). Let C(c) be a candidate set, **independently checked** by re-encoding with the same E.

- Predict only y in C(c), or abstain if empty.
- Verify E(y)=c after every selection.
- A many-to-one E cannot have universal Unicode-to-Unicode exact round-trip from c alone.
- VF1 uses an extra UTF-8 byte sidecar and CRC32, so valid frames round-trip their original bytes; this is not CVNSS4.0 injectivity, not compression, and CRC32 is not authentication.
- Base27 mapping in this repository: SPACE=0; A=1; ...; Z=26. Each ID maps uniquely to exactly three ordinary trits (0,1,2). This is **not** a physical ternary MCU ISA nor a measured neural compression advantage.

For candidate score s_theta(y,c,h), conditional p_theta(y|c,h) = softmax over y in C(c). Train with cross-entropy on gold choices and backpropagation through the GRU. No gradient travels through the fixed encoder.

## Runnable mathematical proof-of-mechanism (no AI claims)

From repository root:

    python3 research/backprop/toy_gradient.py

The script compares an analytic cross-entropy gradient to a finite difference derivative, then verifies decreasing loss over 50 SGD steps for a **synthetic two-candidate logistic model**. It is not a GRU run, Viterbi comparison, corpus accuracy test or on-board result.

## Required corpus format for subsequent GRU / Viterbi experiment

Store train.jsonl, dev.jsonl and test.jsonl in a separately licensed dataset location, one sentence per JSONL line:

    {"id":"doc-001-s1","tokens":[{"code":"FAIZ","candidates":["phải"],"gold":"phải"}]}

The single-candidate example demonstrates the field structure, not an ambiguity example or a training signal. **Do not invent fake ambiguity alternatives**. Generate each code and list of actual valid Unicode candidates by version-locked CVNSS4.0 v5, then re-encode every candidate and verify E(y)=code before exporting. Keep converter commit SHA, NLP tokenization and normalization rules. Long sentences and complex whitespace must be specified and tested.

Corpus requirements:
1. Source licensing and attribution must allow processing and publication; separate documents/authors/sources across train/dev/test.
2. Each Unicode gold label must be present in its candidate list. Deduplicate NFC-normalized candidates.
3. Record every case where E(y)=code cannot be verified and exclude it with an audit reason (do not silently force an answer).
4. Include genuinely ambiguous cases, out-of-vocabulary words and noncanonical normalization tests.
5. Report class counts, ambiguity rate and coverage. A corpus of only one-candidate tokens cannot demonstrate learned disambiguation.

## Baseline protocol

- **E0:** fixed CVNSS4.0 canonical decoder.
- **E1:** bigram-smoothed Viterbi, optimizing a sentence-level path through the same candidate lattice.
- **E2:** GRU candidate ranker (initial design: input embedding 24, GRU hidden 48, candidate representation and softmax restricted to the candidate lattice).
- **E3:** E2 with quantization-aware training (int8 first, ternary-weight variant only as an ablation).
- **E4:** firmware inference on an actual ESP32-S3, with UART logs and memory/time instrumentation.

E1 and E2 must train on the same training sources and be selected on the same dev split; compare on a withheld test split. If the GRU predicts choices independently per position, report that methodological difference rather than claiming equal global sequence decoding. A stronger E2 can use beam decoding with GRU scores.

Suggested controlled measurements: full-token accuracy, ambiguous-only accuracy, CER/WER, unseen-word accuracy, abstention rate, exact checked-code round trip, model bytes, ESP32-S3 Flash/RAM peak, latency p50/p95 and energy. Use multiple seeds, bootstrap confidence intervals and document any tuned parameters.

## ESP32-S3 / portability constraints

- Train with Python/PyTorch on a host; the firmware uses a frozen compact C++ inference implementation without requiring Python/JavaScript on device.
- Base27/trit VF1 is a **data** representation. Ternary neural weights are a separate **model quantization** technique. ESP32-S3 remains physically binary.
- BilaScript is a frontend/expression layer (existing v4 compiles to JavaScript); it is not an Xtensa native backend.
- Existing C++, Java, Python and Swift clients verify the **transport protocol**. They should not be presented as four independent full CVNSS4.0 converters.
- CRC32 detects accidental corruption, not malicious tampering. Add authenticated framing and replay protection for security-sensitive devices.
- Prior host/CI parity and ESP-IDF cross-build evidence must not be relabeled as running neural inference on a real board.

## Acceptance gates (not results)

1. Formal: base27 round-trip for all 27 symbols; symbolic membership and re-encoding assertions; malformed frame rejection.
2. Scientific: real ambiguous corpus and documented train/dev/test; reproducible E0/E1/E2 scripts and fixed random seeds.
3. Statistical: confidence interval of ambiguity accuracy difference (E2 minus E1) and independent sources.
4. Embedded: parity of host vs actual ESP32-S3 output; latency/heap/Flash measured on device with raw logs and build hashes.
5. Claims: *only* publish measured speed/accuracy/memory improvements after satisfying all preceding gates.

## References

- Rumelhart, D. E., Hinton, G. E., & Williams, R. J. (1986). Learning representations by back-propagating errors. Nature 323, 533–536. https://doi.org/10.1038/323533a0
- Cho, K. et al. (2014). Learning Phrase Representations using RNN Encoder–Decoder for Statistical Machine Translation. https://arxiv.org/abs/1406.1078
- CVNSS4.0: Kiều Trường Lâm and Trần Tư Bình; upstream audit-safe converter: https://github.com/xulytiengviet/CVNSS4.0
- Current VF1 and firmware source in this repository.

**Maintainer/research implementation:** Long Ngo. Original CVNSS4.0 authorship and rights remain acknowledged separately.
