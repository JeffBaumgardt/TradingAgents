import unittest
from unittest.mock import patch

from tradingagents.llm_clients.anthropic_client import AnthropicClient
from tradingagents.llm_clients.model_capabilities import (
    get_model_capabilities,
    supports_anthropic_effort,
    supports_openai_reasoning_effort,
)
from tradingagents.llm_clients.openai_client import OpenAIClient


class ModelCapabilityTests(unittest.TestCase):
    def test_anthropic_effort_supported_models(self):
        supported = [
            "claude-opus-4-6",
            "claude-opus-4-5",
            "claude-sonnet-4-6",
        ]
        for model in supported:
            with self.subTest(model=model):
                self.assertTrue(supports_anthropic_effort(model))

    def test_anthropic_effort_unsupported_models(self):
        unsupported = [
            "claude-haiku-4-5",
            "claude-sonnet-4-5",
            "claude-3-5-sonnet-20241022",
        ]
        for model in unsupported:
            with self.subTest(model=model):
                self.assertFalse(supports_anthropic_effort(model))

    def test_openai_reasoning_effort_supported_models(self):
        for model in ("gpt-5.4", "gpt-5.4-mini", "gpt-4.1", "o3-mini"):
            with self.subTest(model=model):
                self.assertTrue(supports_openai_reasoning_effort(model))

    def test_openai_reasoning_effort_unsupported_models(self):
        for model in ("gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"):
            with self.subTest(model=model):
                self.assertFalse(supports_openai_reasoning_effort(model))

    def test_catalog_haiku_flags_no_effort(self):
        caps = get_model_capabilities("anthropic", "claude-haiku-4-5")
        self.assertFalse(caps["anthropicEffort"])


class AnthropicClientEffortTests(unittest.TestCase):
    @patch("tradingagents.llm_clients.anthropic_client.NormalizedChatAnthropic")
    def test_skips_effort_for_haiku(self, mock_chat):
        client = AnthropicClient("claude-haiku-4-5", effort="high")
        client.get_llm()
        call_kwargs = mock_chat.call_args[1]
        self.assertNotIn("effort", call_kwargs)

    @patch("tradingagents.llm_clients.anthropic_client.NormalizedChatAnthropic")
    def test_passes_effort_for_opus(self, mock_chat):
        client = AnthropicClient("claude-opus-4-6", effort="high")
        client.get_llm()
        call_kwargs = mock_chat.call_args[1]
        self.assertEqual(call_kwargs.get("effort"), "high")


class OpenAIClientReasoningEffortTests(unittest.TestCase):
    @patch("tradingagents.llm_clients.openai_client.NormalizedChatOpenAI")
    def test_skips_reasoning_effort_for_legacy_model(self, mock_chat):
        client = OpenAIClient("gpt-4o", provider="openai", reasoning_effort="high")
        client.get_llm()
        call_kwargs = mock_chat.call_args[1]
        self.assertNotIn("reasoning_effort", call_kwargs)

    @patch("tradingagents.llm_clients.openai_client.NormalizedChatOpenAI")
    def test_passes_reasoning_effort_for_gpt5(self, mock_chat):
        client = OpenAIClient("gpt-5.4", provider="openai", reasoning_effort="medium")
        client.get_llm()
        call_kwargs = mock_chat.call_args[1]
        self.assertEqual(call_kwargs.get("reasoning_effort"), "medium")


if __name__ == "__main__":
    unittest.main()
