"""Mídia pública temporária, Whisper local e duas amostras visuais. Sem cookies."""
import sys, json, pathlib, tempfile, subprocess, base64, shutil
from urllib.parse import urlparse
import yt_dlp
import numpy as np
from faster_whisper import WhisperModel
root = pathlib.Path(__file__).resolve().parents[1]
sys.stdout.reconfigure(encoding='utf-8')
url = sys.argv[1]
host = urlparse(url).hostname
if host not in ('youtube.com','www.youtube.com','youtu.be','www.tiktok.com','tiktok.com','www.instagram.com','instagram.com'):
    raise ValueError('Fonte de vídeo não suportada.')
runtime = root / 'data' / 'runtime'
with tempfile.TemporaryDirectory(prefix='media-', dir=runtime) as temp:
    options = {'quiet':True,'noprogress':True,'no_warnings':True,'noplaylist':True,'retries':1,'socket_timeout':20,'max_filesize':100*1024*1024,'outtmpl':str(pathlib.Path(temp)/'source.%(ext)s'),'js_runtimes':{'node':{'path':r'C:\Program Files\nodejs\node.exe'}},'merge_output_format':'mp4','format':'bv[height<=480][ext=mp4]+ba[ext=m4a]/b[height<=480]/worst','ffmpeg_location':shutil.which('ffmpeg')}
    with yt_dlp.YoutubeDL(options) as ydl:
        info=ydl.extract_info(url,download=False)
        if (info.get('duration') or 0)>1200:
            raise ValueError('Vídeo acima de 20 minutos: processe um arquivo menor nesta primeira versão.')
        info=ydl.extract_info(url,download=True)
        media=pathlib.Path(ydl.prepare_filename(info))
    if not media.exists(): raise ValueError('A fonte não disponibilizou mídia pública.')
    whisper=WhisperModel('base',device='cpu',compute_type='int8',download_root=str(root/'data'/'models'/'whisper'))
    decoded=subprocess.run([shutil.which('ffmpeg'),'-loglevel','error','-i',str(media),'-f','s16le','-ar','16000','-ac','1','pipe:1'],capture_output=True,check=True)
    audio=np.frombuffer(decoded.stdout,dtype=np.int16).astype(np.float32)/32768.0
    segments, detected=whisper.transcribe(audio,beam_size=3)
    transcript='\n'.join(f'[{int(s.start//60):02}:{int(s.start%60):02}] {s.text.strip()}' for s in segments)
    frames=[]
    for i,second in enumerate([0, int((info.get('duration') or 4)/2)]):
        output=pathlib.Path(temp)/f'frame{i}.jpg'
        subprocess.run([shutil.which('ffmpeg'),'-loglevel','error','-y','-ss',str(second),'-i',str(media),'-frames:v','1','-vf','scale=640:-1',str(output)],check=False,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        if output.exists():frames.append(base64.b64encode(output.read_bytes()).decode())
    print(json.dumps({'transcript':transcript,'caption':info.get('description') or '', 'frames':frames},ensure_ascii=False))
