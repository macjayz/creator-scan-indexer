#!/bin/bash

echo "🚀 Starting Bytecode Scanner..."
echo "==============================="

# Check if database is running
if ! pg_isready -h localhost -p 5433 > /dev/null 2>&1; then
    echo "❌ Database is not running on port 5433"
    echo "Starting database with docker-compose..."
    docker-compose up -d
    sleep 5
fi

# Check if other indexers are running
echo "📊 Checking existing processes..."
ps aux | grep -E "(factory-watcher|dex-watcher)" | grep -v grep

# Navigate to indexer directory
cd indexer

echo ""
echo "🔧 Starting Bytecode Scanner..."
echo "Press Ctrl+C to stop"
echo ""

# Run the scanner
npm run bytecode-scanner
