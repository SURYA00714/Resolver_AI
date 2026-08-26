# FILE: tests/test_state_machine.py
"""Tests for the 10-state payment state machine."""
import unittest
from core.state_machine import (
    CAPTURED, COMPENSATING, CREATED, DUPLICATE_SUSPECTED, FAILED,
    MANUAL_REVIEW, PENDING_RAIL, RECONCILED, UNCERTAIN, VERIFYING,
    VALID_STATES, allowed_events, is_terminal, transition,
)


class TestStates(unittest.TestCase):
    def test_valid_states_count(self):
        self.assertEqual(len(VALID_STATES), 10)

    def test_terminal_states(self):
        self.assertTrue(is_terminal(CAPTURED))
        self.assertTrue(is_terminal(RECONCILED))
        self.assertTrue(is_terminal(MANUAL_REVIEW))
        self.assertTrue(is_terminal(FAILED))

    def test_non_terminal_states(self):
        self.assertFalse(is_terminal(CREATED))
        self.assertFalse(is_terminal(PENDING_RAIL))
        self.assertFalse(is_terminal(UNCERTAIN))
        self.assertFalse(is_terminal(VERIFYING))
        self.assertFalse(is_terminal(COMPENSATING))
        self.assertFalse(is_terminal(DUPLICATE_SUSPECTED))


class TestTransitions(unittest.TestCase):
    def test_happy_path(self):
        self.assertEqual(transition(CREATED, "SUBMIT"), PENDING_RAIL)
        self.assertEqual(transition(PENDING_RAIL, "TIMEOUT"), UNCERTAIN)
        self.assertEqual(transition(UNCERTAIN, "VERIFIED_SUCCESS"), CAPTURED)

    def test_failure_path(self):
        self.assertEqual(transition(UNCERTAIN, "VERIFIED_FAILED"), FAILED)
        self.assertEqual(transition(PENDING_RAIL, "RAIL_REJECT"), FAILED)

    def test_duplicate_path(self):
        self.assertEqual(transition(UNCERTAIN, "DUPLICATE_DETECTED"), DUPLICATE_SUSPECTED)
        self.assertEqual(transition(CAPTURED, "LATE_DUPLICATE"), DUPLICATE_SUSPECTED)

    def test_compensation_path(self):
        self.assertEqual(transition(DUPLICATE_SUSPECTED, "COMPENSATE"), COMPENSATING)
        self.assertEqual(transition(COMPENSATING, "COMPENSATION_CONFIRMED"), RECONCILED)
        self.assertEqual(transition(COMPENSATING, "COMPENSATION_FAILED"), MANUAL_REVIEW)

    def test_unknown_event_fallback(self):
        self.assertEqual(transition(CREATED, "BOGUS_EVENT"), MANUAL_REVIEW)

    def test_invalid_state_raises(self):
        with self.assertRaises(ValueError):
            transition("NONEXISTENT_STATE", "SUBMIT")

    def test_allowed_events(self):
        events = allowed_events(UNCERTAIN)
        self.assertIn("VERIFIED_SUCCESS", events)
        self.assertIn("VERIFIED_FAILED", events)
        self.assertIn("DUPLICATE_DETECTED", events)


if __name__ == "__main__":
    unittest.main()

