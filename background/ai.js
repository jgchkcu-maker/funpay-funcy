// Disabled release services have no network implementation.
async function unavailable() { return { success: false, code: 'FEATURE_UNAVAILABLE', error: 'Функция временно недоступна.' }; }
export async function fetchAIResponse() { return unavailable(); }
export async function fetchAILotGeneration() { return unavailable(); }
export async function fetchAIImageGeneration() { return unavailable(); }
