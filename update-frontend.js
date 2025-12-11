// Replace the getFactoryInfo function with this:

function getFactoryInfo(factoryAddress, uiDeployer) {
    if (!factoryAddress) return '';
    
    const factories = {
        '0x777777751622c0d3258f214f9df38e35bf45baf3': 'Zora',
        '0x2a787b2362021cc3eea3c24c4748a6cd5b687382': 'Clanker',
        '0x33128a8fc17869897dce68ed026d694621f6fdfd': 'Uniswap V3'
    };
    
    const addr = factoryAddress.toLowerCase();
    const platform = factories[addr] || 'Custom';
    
    // Determine which app was likely used
    let appInfo = '';
    if (uiDeployer && uiDeployer !== '0x0000000000000000000000000000000000000000') {
        const deployer = uiDeployer.toLowerCase();
        
        // High-volume deployers = Base App
        const baseAppDeployers = [
            '0x4b5c33c3c7a31bd108f5a99b64683b0056a62226',
            '0xbdbebd58cc8153ce74530bb342427579315915b2', 
            '0x54e2acab04c89a3fe02852bf8dd69ee8f526bc75',
            '0xaf2bfb6b69dfe6efd257fe8cd694175156a23812'
        ];
        
        if (baseAppDeployers.includes(deployer)) {
            appInfo = '<div style="margin-top: 8px; color: #666; font-size: 0.85rem;">📱 Created via <strong>Base App</strong></div>';
        } else {
            // Individual deployers = Direct or other apps
            // For Zora factory tokens, assume Zora App
            if (platform === 'Zora') {
                appInfo = '<div style="margin-top: 8px; color: #666; font-size: 0.85rem;">🎨 Created via <strong>Zora App</strong></div>';
            } else {
                appInfo = '<div style="margin-top: 8px; color: #666; font-size: 0.85rem;">👤 Created via <strong>User Wallet</strong></div>';
            }
        }
    }
    
    return `
        <div class="factory-info">
            <strong>${platform} Platform</strong>
            ${appInfo}
        </div>
    `;
}
