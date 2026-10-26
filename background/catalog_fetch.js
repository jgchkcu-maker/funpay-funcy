export function catalogUrl(value, action) {
    const url = new URL(value, 'https://funpay.com');
    const route = action === 'getCategoryList' ? /^\/(?:en\/|uk\/)?games\/[\w-]+\/$/ : /^\/(?:en\/|uk\/)?lots\/\d+\/$/;
    if (url.origin !== 'https://funpay.com' || url.username || url.password || url.search || url.hash || !route.test(url.pathname)) throw new Error('Неподдерживаемый адрес каталога FunPay.');
    return url.href;
}
export async function fetchCatalogPage(value, action, fetchImpl = fetch) {
    let url = catalogUrl(value, action);
    for (let redirects = 0; redirects < 3; redirects++) {
        // manual prevents the browser from contacting an unvalidated redirect origin.
        const response = await fetchImpl(url, { credentials: 'include', redirect: 'manual' });
        if (response.type === 'opaqueredirect') throw new Error('Переход каталога скрыт браузером. Откройте раздел FunPay заново.');
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (!location) throw new Error('Каталог перенаправил запрос без адреса.');
            url = catalogUrl(new URL(location, url).href, action);
            continue;
        }
        if (!response.ok) throw new Error(`Каталог FunPay: HTTP ${response.status}`);
        return response.text();
    }
    throw new Error('Слишком много переходов каталога.');
}
