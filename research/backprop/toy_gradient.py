#!/usr/bin/env python3
"""Minimal, reproducible two-candidate softmax / backpropagation check.

This is a toy gradient check, NOT a trained GRU, a CVNSS4.0 ambiguity
benchmark, or an ESP32-S3 hardware measurement. No dependencies.
"""
import math


def sigmoid(value):
    return 1.0 / (1.0 + math.exp(-value))


def loss(weight):
    return -math.log(sigmoid(weight))


def analytic_gradient(weight):
    return sigmoid(weight) - 1.0


def numeric_gradient(weight, epsilon=1e-6):
    return (loss(weight + epsilon) - loss(weight - epsilon)) / (2 * epsilon)


def main():
    weight, lr, steps = 0.0, 0.2, 50
    initial = loss(weight)
    assert abs(analytic_gradient(weight) - numeric_gradient(weight)) < 1e-6
    for _ in range(steps):
        old_loss = loss(weight)
        weight -= lr * analytic_gradient(weight)
        assert loss(weight) < old_loss, "Loss did not decrease for toy example"
    print("TOY GRADIENT CHECK: PASS")
    print("Initial loss: %.8f" % initial)
    print("After %d steps: %.8f" % (steps, loss(weight)))
    print("P(correct candidate): %.8f" % sigmoid(weight))
    print("Evidence: only scalar logistic cross-entropy and gradient descent.")
    print("No CVNSS4.0/GRU/Viterbi/ESP32-S3 result is implied.")


if __name__ == "__main__":
    main()
