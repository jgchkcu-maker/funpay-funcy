# Ресурсы 0.9.12

## Что в пакете

* Иконки Funcy (буква F) и стартовый маскот сохранены из пользовательского checkout. Их происхождение и права владелец проекта должен подтвердить до подачи.
* jQuery 3.7.1 и Material Symbols поставляются с notices и полными текстами лицензий. Исходная MIT-атрибуция AlliSighs сохранена.
* Бывший дефолтный фон с i.ibb.co заменён локальным CSS-градиентом. Миграция переносит только точное старое значение, собственные фоны пользователя сохраняются.
* Звуки VK, Telegram, iPhone, Discord и WhatsApp исключены из пакета. Их id мигрируют в стандартный звук, пользовательский звук сохраняется.

## Каталог тем (загружается с GitHub, в пакет не входит)

`https://raw.githubusercontent.com/jgchkcu-maker/funcy-assets/main/index.json` на 1 ноября 2026 года отдаёт 6 тем:

| id | Название | Файлы | Что проверить |
| --- | --- | --- | --- |
| gargantua | Gargantua | wallpapers/gargantua.jpg | **Высокий риск.** Название совпадает с чёрной дырой из фильма «Интерстеллар». Если это кадр или арт из фильма, тему нужно убрать из каталога или заменить своим изображением. |
| underwater | Underwater | wallpapers/underwater.webp, underwater.mp4 | Источник фото и видео, лицензия (например, Pexels, Unsplash или своё) |
| winter-forest | Winter Forest | wallpapers/winter-forest.webp, winter-forest.mp4 | То же |
| fog | Fog | wallpapers/fog.webp | То же |
| clouds | Clouds | wallpapers/clouds.webp | То же |
| the-tree | The Tree | wallpapers/the-tree.webp | То же |

Темы `ghoul-ink` и `white-ghoul` (арт по аниме) расширение отфильтровывает само (`content/features/theme_assets.js`).

Рекомендация: добавить в репозиторий `funcy-assets` файл `CREDITS.md` с источником и лицензией каждого файла. Каталог меняется без обновления расширения, поэтому модератор увидит то, что лежит в репозитории в день проверки.

Пользователь отвечает за собственные загружаемые обои; они хранятся только в его браузере.
