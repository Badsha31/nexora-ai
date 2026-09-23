# Nexora AI

Nexora AI is a private software-development factory: the Node control plane manages projects, policy, files, terminal operations, builds/tests, memory, repository context and the autonomous coding loop, while the **Nexora Coding Model Runtime** provides real model inference.

## Real coding model

The default model runtime is **Qwen/Qwen3-Coder-Next**, served behind Nexora's model adapter as the logical model name `nexora-coder`. Qwen publishes this as an open-weight coding-agent model with native 256K context and agentic/tool-calling support. Nexora does not store the large model weights in GitHub; the GPU model host downloads them when the runtime starts.

See `model-server/README.md` for the real GPU setup.

## Architecture

```
Nexora Web UI
      |
      v
Node Control Plane
      |
      +--> Policy / Auth / Project Memory
      |
      +--> Repository Context
      |
      +--> Agent Engine
      |       |
      |       +--> Files
      |       +--> Terminal
      |       +--> Build
      |       +--> Test
      |
      v
Nexora Coding Model Runtime
      |
      v
Qwen3-Coder-Next weights on GPU host
```

## Run control plane

```bash
npm install
npm start
```

Open `http://127.0.0.1:8787`.

## Connect the model

On the model host:

```bash
cd model-server
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install "vllm>=0.15.0"
cp config.env.example .env
set -a; source .env; set +a
bash start-vllm.sh
```

The model API is then available at `http://<model-host>:8000/v1`.

On the Nexora control plane:

```env
NEXORA_MODEL_URL=http://<model-host>:8000/v1
NEXORA_MODEL_NAME=nexora-coder
NEXORA_MODEL_API_KEY=<optional-secret>
```

Verify the real inference service:

```bash
npm run model:health
npm run model:test
```

## Important deployment note

The model runtime is a separate GPU workload. A normal CPU web service such as the current Render control-plane deployment should not be treated as the place where the 80B-parameter model weights are loaded. The control plane connects to the GPU inference service over the private/network endpoint you configure.

## Current limitations

- The current terminal executor is a controlled subprocess runner, not yet a VM/microVM-grade sandbox.
- Cloud deployment adapters still require provider credentials/integration.
- Android APK/AAB builds require a dedicated Android build worker with SDK/Gradle.
- SQLite is suitable for initial operation; production durability should move to a persistent database.

## Admin policy

Safety and operation permissions remain backend-enforced. The model cannot change its own policy; the Master Admin controls policy state outside the model loop.
