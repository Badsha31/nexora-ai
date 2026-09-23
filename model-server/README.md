# Nexora Coding Model Runtime

This directory is the real model-serving layer for Nexora AI. It is intentionally separate from the Node control plane because serious coding-model inference needs a GPU-capable host.

## Model

The default runtime uses **Qwen/Qwen3-Coder-Next**, an open-weight coding model intended for coding agents and local development. The model provides 256K native context and supports agentic tool calling. The official model instructions require vLLM 0.15.0+ for the vLLM path and show the Qwen3-Coder tool parser.

Nexora does **not** copy model weights into GitHub. The runtime downloads/loads the model from its model registry on the GPU machine.

## Start

Install a current NVIDIA driver/CUDA environment, then:

```bash
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install "vllm>=0.15.0"
cp config.env.example .env
set -a; source .env; set +a
bash start-vllm.sh
```

The server exposes an OpenAI-compatible API at:

```
http://<model-host>:8000/v1
```

Check it:

```NEXORA_MODEL_URL=http://127.0.0.1:8000/v1 node health-check.mjs```

## GPU/context tuning

The default configuration uses 2-way tensor parallelism and a 32K context to make first deployment less demanding than the model's full 256K context. If the server has enough memory, increase `NEXORA_MAX_MODEL_LEN`. The official Qwen model card notes that the default context is 256K and recommends reducing it if the server cannot start.

For a single GPU, set `NEXORA_TENSOR_PARALLEL_SIZE=1` only if that hardware can actually load the selected model. Do not claim the model is running until `/v1/models` returns successfully.

## Connect Nexora AI

On the Node control-plane service set:

```
NEXORA_MODEL_URL=http://<model-host>:8000/v1
NEXORA_MODEL_NAME=nexora-coder
NEXORA_MODEL_API_KEY=<same-key-if-enabled>
```

Then Nexora's existing agent engine sends coding tasks to this real inference endpoint.

## Important

This is a real open-weight model runtime, not a fake local model. The Git repository contains the serving configuration and integration code, while the multi-gigabyte model weights stay on the model host.

A future proprietary **Nexora Coding Model** can be produced by fine-tuning an approved base model with Nexora's own licensed coding dataset and evaluation suite. That is a separate training job; the runtime here is already capable of serving the resulting model by changing `NEXORA_MODEL_ID`.
