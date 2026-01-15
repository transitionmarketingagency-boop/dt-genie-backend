#!/bin/bash
# run-all.sh

# 1️⃣ Kill any process using port 5000
echo "Checking for existing server on port 5000..."
PID=$(lsof -t -i:5000)
if [ ! -z "$PID" ]; then
  echo "Killing process $PID on port 5000..."
  kill -9 $PID
fi

# 2️⃣ Populate test data
echo "Populating test data..."
npx tsx server/populate-test-data.ts

# 3️⃣ Run Hybrid AI tests
echo "Running Hybrid AI tests..."
npx tsx server/services/hybridTest.ts

# 4️⃣ Start production server (fixed entry point)
echo "Starting production server..."
npx tsx server/index-prod.ts
