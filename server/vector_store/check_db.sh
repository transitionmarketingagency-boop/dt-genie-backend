#!/bin/bash
sqlite3 server/vector_store/unified_chunks.db <<EOF
SELECT COUNT(*) FROM chunks;
SELECT content FROM chunks LIMIT 5;
EOF
