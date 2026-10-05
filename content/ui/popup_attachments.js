// Replacement editors pass files and attachment arrays explicitly.
if (typeof window !== 'undefined' && window.fptPopupActions) {
    const add = async p => {
        if (!p.file || !/^image\/(png|jpeg|gif|webp)$/.test(p.file.type) || p.file.size > 1024 * 1024) throw new Error('Выберите изображение PNG/JPEG/GIF/WebP до 1 МБ.');
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Не удалось прочитать файл.'));
            reader.readAsDataURL(p.file);
        });
        return [...(p.images || []), dataUrl];
    };
    for (const page of ['auto_reply', 'auto_review', 'templates']) {
        window.fptPopupActions.register(page, 'handleImageAddClick', add);
        window.fptPopupActions.register(page, 'getEditorAttachments', p => ({ images: p.images || [], sendOrder: p.sendOrder || 'text_first' }));
    }
}
