// Link glue for the WASM build of QGTL core (770994a). geometric_initialize() in quantum_geometric_operations.c
// calls cleanup_memory_pool(MemoryPool*), which core declares but never defines (only ai/quantum_llm_core.c defines a
// same-named function for a different type). We forward it to core's own destroy_memory_pool(MemoryPool*).
typedef struct MemoryPool MemoryPool;
void destroy_memory_pool(MemoryPool* pool);
void cleanup_memory_pool(MemoryPool* pool) { destroy_memory_pool(pool); }
