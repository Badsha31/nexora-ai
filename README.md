# Nexora AI

Private AI development factory platform. This repository contains a runnable control plane with real SQLite persistence, authentication, policy enforcement, project isolation, repository indexing, terminal execution, build/test execution, deployment adapters, model adapter health checks, project memory, observability, and a web workspace.

## Current environment limitations
- Self-hosted model: requires a configured OpenAI-compatible local endpoint (for example Ollama/vLLM). No model server is assumed.
- Android: Gradle/ADB/Android SDK are not installed in the build environment, so Android artifacts are reported as blocked rather than fabricated.
- Cloud deployment: requires external credentials and an enabled deployment integration.

## Run
`npm start` then open `http://127.0.0.1:8787`.

The first boot creates a random admin password and prints it once to the server console. Set `NEXORA_ADMIN_PASSWORD` before first boot to choose one.
