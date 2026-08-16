# Selos TSE (PNG)

Gerados offline com FFmpeg+fonte (`assets/fonts/DejaVuSans.ttf`) porque o
binário `ffmpeg-static` no Cloud Run **não inclui** o filtro `drawtext`.

Em runtime o selo é aplicado com `overlay` (sempre presente).

## Regenerar

```bash
FF=$(node -e "console.log(require('ffmpeg-static'))")
FONT=assets/fonts/DejaVuSans.ttf

# TSE: letra 2× (fontsize 60), fundo transparente, contorno preto (sem tarja).
$FF -y -f lavfi -i "color=c=0x00000000:s=2560x160:d=1,format=rgba" \
  -vf "drawtext=fontfile=${FONT}:text='Conteúdo gerado por Inteligência Artificial - Res. TSE 23.610/19 e 23.755/26':fontsize=60:fontcolor=white:borderw=5:bordercolor=black:x=24:y=(h-text_h)/2" \
  -frames:v 1 -update 1 assets/seals/tse-seal.png
# Recortar o canvas ao texto + 16px (alpha) para o overlay não encolher a letra.

$FF -y -f lavfi -i "color=c=0x00000000:s=980x68:d=1,format=rgba" \
  -vf "drawbox=x=0:y=0:w=iw:h=ih:color=black@0.6:t=fill,drawtext=fontfile=${FONT}:text='VERSÃO DE TESTE - SEM VALIDADE LEGAL':fontsize=28:fontcolor=white:x=16:y=(h-text_h)/2" \
  -frames:v 1 -update 1 assets/seals/guest-test-seal.png

$FF -y -f lavfi -i "color=c=0x00000000:s=1280x72:d=1,format=rgba" \
  -vf "drawbox=x=0:y=0:w=iw:h=ih:color=black@0.72:t=fill,drawtext=fontfile=${FONT}:text='Divulgação autorizada somente em período de campanha, após 16/Agosto.':fontsize=26:fontcolor=white:x=16:y=(h-text_h)/2" \
  -frames:v 1 -update 1 assets/seals/campaign-tarja-seal.png
```

Requer FFmpeg local com `drawtext` (macOS/`ffmpeg-static` no Mac costuma ter).
