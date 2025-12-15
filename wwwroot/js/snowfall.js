// Snowfall effect for background
(function() {
    const snowfallContainer = document.getElementById('snowfall');
    if (!snowfallContainer) return;

    const snowflakeCount = 50;

    function createSnowflake() {
        const snowflake = document.createElement('div');
        snowflake.className = 'snowflake';

        const size = Math.random() * 6 + 2;
        const startX = Math.random() * 100;
        const duration = Math.random() * 10 + 10;
        const delay = Math.random() * 10;

        snowflake.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            left: ${startX}%;
            animation-duration: ${duration}s;
            animation-delay: -${delay}s;
        `;

        return snowflake;
    }

    // Create initial snowflakes
    for (let i = 0; i < snowflakeCount; i++) {
        snowfallContainer.appendChild(createSnowflake());
    }
})();
