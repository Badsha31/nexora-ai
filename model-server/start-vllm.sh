#!/usr/bin/env bash
set -euo pipefail

MODEL="${NEXORA_MODEL_ID:-Qwen/Qwen3-Coder-Next}"
SERVED_NAME="${NEXORA_SERVED_MODEL_NAME:-nexora-coder}"
HOST="${NEXORA_MODEL_HOST:-0.0.0.0}"
PORT="${NEXORA_MODEL_PORT:-8000}"
TP="${NEXORA_TENSOR_PARALLEL_SIZE:-2}"
MAX_LEN="${NEXORA_MAX_MODEL_LEN:-32768}"
GPU_MEM="${NEXORA_GPU_MEMORY_UTILIZATION:-0.90}"
API_KEY="${NEXORA_MODEL_API_KEY:-}"

ARGS=(
  "$MODEL"
  --served-model-name "$SERVED_NAME"
  --host "$HOST"
  --port "$PORT"
  --tensor-parallel-size "$TP"
  --max-model-len "$MAX_LEN"
  --gpu-memory-utilization "$GPU_MEM"
  --enable-auto-tool-choice
  --tool-call-parser qwen3_coder
)

if [[ -n "$API_KEY" ]]; then
  ARGS+=(--api-key "$API_KEY")
fi

echo "Starting Nexora Coding Model: $MODEL"
echo "OpenAI-compatible endpoint: http://$HOST:$PORT/v1"
exec vllm serve "${ARGS[@]}"
