document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('開始載入模型...');
        
        // 設定模型路徑
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/';
        
        // 載入模型
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        
        console.log('模型載入完成');

        const imageUpload = document.getElementById('imageUpload');
        const processBtn = document.getElementById('processBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        const mosaicSize = document.getElementById('mosaicSize');
        const imageList = document.getElementById('imageList');
        const sizeLabel = document.querySelector('.size-label');
        const themeToggle = document.getElementById('themeToggle');

        let uploadedImages = [];

        // 主題切換
        themeToggle.addEventListener('click', () => {
            const html = document.documentElement;
            const currentTheme = html.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            html.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });

        // 載入已儲存的主題
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);

        // 更新馬賽克大小標籤
        mosaicSize.addEventListener('input', () => {
            sizeLabel.textContent = `${mosaicSize.value}px`;
        });

        // 處理圖片上傳
        imageUpload.addEventListener('change', (e) => {
            uploadedImages = [];
            imageList.innerHTML = '';
            
            const files = Array.from(e.target.files).filter(file => 
                file.type.startsWith('image/')
            );

            if (files.length > 0) {
                files.forEach((file, index) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const img = new Image();
                        img.src = e.target.result;
                        img.onload = () => {
                            uploadedImages.push({
                                original: img,
                                processed: null,
                                index: index,
                                name: file.name
                            });

                            const div = document.createElement('div');
                            div.className = 'image-item';
                            div.innerHTML = `
                                <div class="image-preview">
                                    <div class="preview-original">
                                        <span class="preview-label">原始圖片</span>
                                        <img src="${e.target.result}" alt="原始圖片">
                                    </div>
                                    <div class="preview-processed">
                                        <span class="preview-label">處理後</span>
                                        <img src="${e.target.result}" alt="處理後圖片">
                                    </div>
                                </div>
                                <div class="image-name">${file.name}</div>
                            `;
                            imageList.appendChild(div);

                            // 當所有圖片都載入完成時，啟用處理按鈕
                            if (uploadedImages.length === files.length) {
                                processBtn.disabled = false;
                            }
                        };
                    };
                    reader.readAsDataURL(file);
                });
            } else {
                alert('請選擇圖片檔案');
            }
        });

        // 處理圖片
        processBtn.addEventListener('click', async () => {
            try {
                processBtn.disabled = true;
                const size = parseInt(mosaicSize.value);

                for (let i = 0; i < uploadedImages.length; i++) {
                    const imgData = uploadedImages[i];
                    const canvas = document.createElement('canvas');
                    canvas.width = imgData.original.width;
                    canvas.height = imgData.original.height;
                    const ctx = canvas.getContext('2d');
                    
                    // 繪製原始圖片
                    ctx.drawImage(imgData.original, 0, 0);

                    // 偵測人臉
                    const detections = await faceapi.detectAllFaces(
                        imgData.original,
                        new faceapi.TinyFaceDetectorOptions()
                    );

                    if (detections.length > 0) {
                        // 為每個人臉套用馬賽克
                        detections.forEach(detection => {
                            const { x, y, width, height } = detection.box;
                            
                            for (let px = Math.max(0, x); px < Math.min(x + width, canvas.width); px += size) {
                                for (let py = Math.max(0, y); py < Math.min(y + height, canvas.height); py += size) {
                                    const pixelData = ctx.getImageData(px, py, 1, 1).data;
                                    ctx.fillStyle = `rgb(${pixelData[0]},${pixelData[1]},${pixelData[2]})`;
                                    ctx.fillRect(px, py, size, size);
                                }
                            }
                        });
                    } else {
                        console.log(`在圖片 ${imgData.name} 中未偵測到人臉`);
                    }

                    // 更新預覽圖
                    uploadedImages[i].processed = canvas.toDataURL('image/jpeg');
                    const processedImg = imageList.children[i].querySelector('.preview-processed img');
                    processedImg.src = uploadedImages[i].processed;
                }

                processBtn.disabled = false;
                downloadBtn.disabled = false;
            } catch (error) {
                console.error('處理圖片失敗:', error);
                alert('處理圖片失敗，請檢查圖片格式和大小');
                processBtn.disabled = false;
            }
        });

        // 下載處理後的圖片
        downloadBtn.addEventListener('click', () => {
            try {
                uploadedImages.forEach((imgData) => {
                    if (imgData.processed) {
                        const link = document.createElement('a');
                        // 保留原始檔名，但加上 _mosaic 後綴
                        const fileName = imgData.name.replace(/\.[^/.]+$/, '') + '_mosaic.jpg';
                        link.download = fileName;
                        link.href = imgData.processed;
                        link.click();
                    }
                });
            } catch (error) {
                console.error('下載圖片失敗:', error);
                alert('下載圖片失敗，請檢查網路連接');
            }
        });

    } catch (error) {
        console.error('初始化失敗:', error);
        alert('初始化失敗，請確保網路連接正常並重新整理頁面');
    }
});
