# Selos TSE (PNG)

Gerados offline com FFmpeg+fonte (`assets/fonts/DejaVuSans.ttf`) porque o
binário `ffmpeg-static` no Cloud Run **não inclui** o filtro `drawtext`.

Em runtime o selo é aplicado com `overlay` (sempre presente).

## Regenerar

```bash
FF=$(node -e "console.log(require('ffmpeg-static'))")
FONT=assets/fonts/DejaVuSans.ttf

$FF -y -f lavfi -i "color=c=0x00000000:s=1100x72:d=1,format=rgba" \
  -vf "drawbox=x=0:y=0:w=iw:h=ih:color=black@0.6:t=fill,drawtext=fontfile=${FONT}:text='Imagem e voz sintéticas geradas por IA - Res. TSE 23.732':fontsize=28:fontcolor=white:x=16:y=(h-text_h)/2" \
  -frames:v 1 assets/seals/tse-seal.png

$FF -y -f lavfi -i "color=c=0x00000000:s=900x64:d=1,format=rgba" \
  -vf "drawbox=x=0:y=0:w=iw:h=ih:color=black@0.6:t=fill,drawtext=fontfile=${FONT}:text='VERSÃO DE TESTE - SEM VALIDADE LEGAL':fontsize=26:fontcolor=white:x=16:y=(h-text_h)/2" \
  -frames:v 1 assets/seals/guest-test-seal.png
```

Requer FFmpeg local com `drawtext` (macOS/`ffmpeg-static` no Mac costuma ter).
