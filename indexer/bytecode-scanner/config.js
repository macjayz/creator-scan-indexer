// Bytecode Scanner Configuration
export const config = {
    // RPC Configuration
    rpcUrl: process.env.BASE_HTTP_URL || 'https://base-mainnet.g.alchemy.com/v2/WP_xuEGBgpHNNkxTHjcTK',
    
    // Scanner Settings - INCREASED FOR BETTER COVERAGE
    scanBatchSize: 200,           // Increased from 50 to 200 blocks
    maxBytecodeSize: 24576,
    minContractSize: 200,
    
    // Database
    databaseUrl: process.env.DATABASE_URL || "postgresql://creator_scan:local_password@localhost:5433/creator_scan",
    
    // Detection Thresholds
    minERC20Confidence: 0.6,      // Lowered from 0.7 to catch more
    requireTransferEvent: false,  // Made optional (some tokens omit events)
    
    // Performance
    requestDelay: 500,            // Reduced delay for faster scanning
    maxRetries: 3,
    
    // Logging
    logLevel: 'info',
    saveFailedScans: true         // Enable to learn from false negatives
};
