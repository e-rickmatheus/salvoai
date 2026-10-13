import sys,json,base64,cv2,numpy as np
from rapidocr_onnxruntime import RapidOCR
sys.stdout.reconfigure(encoding='utf-8')
engine=RapidOCR()
data=json.load(sys.stdin)
texts=[]
for index,image in enumerate(data['images'][:3]):
    array=np.frombuffer(base64.b64decode(image),dtype=np.uint8)
    pixels=cv2.imdecode(array,cv2.IMREAD_COLOR)
    if pixels is None:raise ValueError('Imagem não decodificável.')
    result,_=engine(pixels)
    text='\n'.join(row[1] for row in (result or []))
    texts.append(f'Imagem amostrada {index+1}:\n'+(text or 'Sem texto legível.'))
print(json.dumps({'text':'\n\n'.join(texts)},ensure_ascii=False))
