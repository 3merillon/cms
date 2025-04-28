// UI Enhancement Script for CMS App
document.addEventListener('DOMContentLoaded', () => {
    // --- Info Panel Logic ---
    const infoPanel = document.getElementById('info-panel');
    const infoPanelHeader = document.getElementById('info-panel-header');
    const infoOpenFab = document.getElementById('info-open-fab');

    function toggleInfoPanel() {
        if (infoPanel.classList.contains('collapsed')) {
            infoPanel.classList.remove('collapsed');
            infoOpenFab.style.display = 'none';
        } else {
            infoPanel.classList.add('collapsed');
            infoOpenFab.style.display = 'flex';
        }
    }

    infoPanelHeader.onclick = toggleInfoPanel;
    infoOpenFab.onclick = (e) => {
        e.stopPropagation();
        toggleInfoPanel();
    };

    // --- Controls Panel Logic ---
    const controlsPanel = document.getElementById('controls');
    const controlsHeader = document.getElementById('controls-header');
    const controlsOpenFab = document.getElementById('controls-open-fab');

    function toggleControlsPanel() {
        if (controlsPanel.classList.contains('collapsed')) {
            controlsPanel.classList.remove('collapsed');
            controlsOpenFab.style.display = 'none';
        } else {
            controlsPanel.classList.add('collapsed');
            controlsOpenFab.style.display = 'flex';
        }
    }

    controlsHeader.onclick = toggleControlsPanel;
    controlsOpenFab.onclick = (e) => {
        e.stopPropagation();
        toggleControlsPanel();
    };

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            controlsPanel.classList.add('collapsed');
            controlsOpenFab.style.display = 'flex';
        }
    });

    // --- Info Panel Debug Info ---
    const debugInfo = document.getElementById('debug-info');
    window.updateDebugInfo = function(info) {
        if (!info) return;
        let html = '<div class="debug-section">';
        // Algorithm Stats Table
        if (info.algorithm) {
            html += '<h4 style="color:#64c8ff; margin-bottom:8px;">Algorithm Stats</h4>';
            html += '<div class="debug-table">';
            for (const [key, value] of Object.entries(info.algorithm)) {
                html += `<div class="debug-row">
                    <span class="debug-label">${key}:</span>
                    <span class="debug-value">${value}</span>
                </div>`;
            }
            html += '</div>';
        }
        // Performance Table
        if (info.performance) {
            html += '<h4 style="color:#64c8ff; margin-bottom:8px; margin-top:16px;">Performance</h4>';
            html += '<div class="debug-table">';
            for (const [key, value] of Object.entries(info.performance)) {
                html += `<div class="debug-row">
                    <span class="debug-label">${key}:</span>
                    <span class="debug-value">${value}</span>
                </div>`;
            }
            html += '</div>';
        }
        html += '</div>';
        debugInfo.innerHTML = html;
    };

    // --- Ensure info panel starts closed and both FABs are visible in their corners ---
    infoPanel.classList.add('collapsed');
    infoOpenFab.style.display = 'flex';
    controlsPanel.classList.remove('collapsed');
    controlsOpenFab.style.display = 'none';
});