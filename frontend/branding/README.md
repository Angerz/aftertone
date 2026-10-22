# Identidad visual de Aftertone / AFTRTone

`Logo_AFTR.png` es el original aprobado, copiado sin cambios. SHA-256:
`37f57185da838e8a903ed5e6e9b69677ca528f476be47db611c3988c5a724d14`.
Se conservan la A serif, el vinilo, la estrella, la paleta terracota/crema y el
fondo oscuro redondeado. El original no se publica en el bundle del navegador.

## Exportaciones

Desde la raíz del repositorio, con Pillow del entorno backend existente:

```sh
backend/.venv/bin/python scripts/export_branding.py
```

El proceso es determinista: recorta únicamente los márgenes transparentes externos,
centra la imagen en un lienzo cuadrado sin deformarla y exporta con Lanczos. Para
delimitar el contenido ignora el ruido de alfa 1/255 del borde. El rectángulo del
original usado es `(88, 91, 1174, 1172)`; el lienzo cuadrado mide 1086 px. No se
redibujan ni regeneran elementos del símbolo.

| Archivo en `public/branding/` | Tamaño | Uso |
| --- | --- | --- |
| `favicon-16.png` | 16 × 16 | Favicon pequeño |
| `favicon-32.png` | 32 × 32 | Favicon de mayor densidad |
| `favicon.ico` | 16 y 32 px | Compatibilidad de navegador |
| `apple-touch-icon.png` | 180 × 180 | Icono Apple, lienzo opaco crema |
| `icon-192.png` | 192 × 192 | Manifest e imagen de interfaz |
| `icon-512.png` | 512 × 512 | Manifest e icono de mayor tamaño |
| `site.webmanifest` | — | Identidad del navegador; `display: browser` |

Los dos tamaños del ICO usan exactamente las mismas imágenes que sus PNG. Los
PNG conservan transparencia salvo Apple touch, cuya base crema permite una imagen
opaca conservando el fondo oscuro y sus esquinas. El manifest no declara iconos
maskable, modo standalone, service worker, caché offline ni un flujo de instalación.

El favicon completo se mantiene: a 16 px la identidad se reconoce principalmente
por la A clara y el disco terracota; los surcos y la estrella pierden detalle. A
32 px se aprecia mejor el conjunto. No se introduce una segunda versión del símbolo
para resolver esa limitación física de tamaño.

## Composición propuesta

- Header interior: símbolo de 28 px en desktop y 26 px en mobile, a la izquierda
  del wordmark **Aftertone**, con 8,8 px de separación. Se conserva su tipografía,
  tamaño, enlace, navegación y altura del header.
- Portada: header con wordmark original; un único sello de 40 px en desktop o
  36 px en mobile acompaña la ceja Aftertone. El título Library, los textos, las
  acciones y el pie conservan su jerarquía editorial.
- El símbolo es decorativo para lectores de pantalla: texto alternativo vacío y
  `aria-hidden`. El nombre accesible del enlace sigue siendo Aftertone.
- La imagen tiene dimensiones declaradas y no incorpora animaciones nuevas.

Se recomienda esta composición complementaria. Duplicar el símbolo en el header
de la portada y en su contenido añadiría una repetición innecesaria; por eso el
header de esa vista conserva solo el wordmark.

FastAPI monta exclusivamente la carpeta de exports en `/branding`, antes del
fallback de la SPA. El manifest se encuentra también bajo ese montaje. Esto evita
que una petición de icono reciba HTML, sin ampliar los permisos de las API ni
publicar el original de trabajo. Vite copia estos assets al build de producción.
