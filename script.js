document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('開始載入模型...');
        
        // 設定模型路徑
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/';
        
        // 載入所有需要的模型
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        
        console.log('模型載入完成');

        const imageUpload = document.getElementById('imageUpload');
        const downloadBtn = document.getElementById('downloadBtn');
        const mosaicSize = document.getElementById('mosaicSize');
        const imageList = document.getElementById('imageList');
        const sizeLabel = document.querySelector('.size-label');
        const themeToggle = document.getElementById('themeToggle');
        const completionModal = document.getElementById('completionModal');
        const modalDownloadBtn = document.getElementById('modalDownloadBtn');
        const modalAdjustBtn = document.getElementById('modalAdjustBtn');

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

        let showCompletionModalEnabled = true;

        // 顯示完成提示
        function showCompletionModal() {
            if (showCompletionModalEnabled) {
                completionModal.classList.add('show');
            }
        }

        // 隱藏完成提示
        function hideCompletionModal() {
            completionModal.classList.remove('show');
        }

        // 點擊視窗外部時關閉視窗
        completionModal.addEventListener('click', (e) => {
            if (e.target === completionModal) {
                hideCompletionModal();
            }
        });

        // 點擊再調整按鈕時自動處理圖片
        modalAdjustBtn.addEventListener('click', async () => {
            hideCompletionModal();
            showCompletionModalEnabled = false;
            
            try {
                let processedCount = 0;
                const totalImages = uploadedImages.length;
                
                for (let i = 0; i < totalImages; i++) {
                    await processImage(i);
                    processedCount++;
                }
            } catch (error) {
                console.error('處理圖片時發生錯誤:', error);
                alert('處理圖片時發生錯誤');
            }
        });

        // 關閉按鈕事件
        const modalCloseBtn = document.querySelector('.modal-close');
        modalCloseBtn.addEventListener('click', hideCompletionModal);

        // 處理圖片上傳
        imageUpload.addEventListener('change', async (e) => {
            resetMosaicSize(); // 重置馬賽克大小
            uploadedImages = [];
            imageList.innerHTML = '';
            hideCompletionModal();
            
            const files = Array.from(e.target.files).filter(file => 
                file.type.startsWith('image/')
            );

            if (files.length > 0) {
                let processedCount = 0;
                for (const file of files) {
                    const reader = new FileReader();
                    reader.onload = async (e) => {
                        const img = new Image();
                        img.src = e.target.result;
                        img.onload = async () => {
                            const index = uploadedImages.length;
                            uploadedImages.push({
                                original: img,
                                processed: null,
                                index: index,
                                name: file.name
                            });

                            const div = document.createElement('div');
                            div.className = 'image-item';
                            div.innerHTML = `
                                <div class="image-name">${file.name}</div>
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
                            `;
                            imageList.appendChild(div);

                            // 自動處理圖片
                            await processImage(index);
                            processedCount++;

                            // 當所有圖片都處理完成時才顯示模態框
                            if (processedCount === files.length) {
                                setTimeout(() => {
                                    showCompletionModal();
                                }, 500);
                            }
                        };
                    };
                    reader.readAsDataURL(file);
                }
            } else {
                alert('請選擇圖片檔案');
            }
        });

        // 馬賽克大小改變時自動更新標籤
        mosaicSize.addEventListener('input', async (e) => {
            sizeLabel.textContent = `${mosaicSize.value}px`;
            
            // 重新處理所有圖片
            if (uploadedImages.length > 0) {
                try {
                    for (let i = 0; i < uploadedImages.length; i++) {
                        await processImage(i);
                    }
                } catch (error) {
                    console.error('處理圖片時發生錯誤:', error);
                }
            }
        });

        // 重置馬賽克大小到預設值
        function resetMosaicSize() {
            const defaultSize = 20;
            mosaicSize.value = defaultSize;
            sizeLabel.textContent = defaultSize;
        }

        // 處理單張圖片
        async function processImage(index) {
            const imgData = uploadedImages[index];
            if (!imgData) return;

            try {
                const canvas = document.createElement('canvas');
                const displayWidth = imgData.original.width;
                const displayHeight = imgData.original.height;
                
                // 設置 canvas 大小為原始圖片大小
                canvas.width = displayWidth;
                canvas.height = displayHeight;
                const ctx = canvas.getContext('2d');
                
                // 繪製原始圖片
                ctx.drawImage(imgData.original, 0, 0);

                // 使用改進的人臉偵測函數
                const detections = await detectFaces(imgData.original);

                if (detections.length > 0) {
                    // 為每個人臉套用馬賽克
                    detections.forEach(detection => {
                        const box = detection.detection.box;
                        const x = Math.max(0, box.x - box.width * 0.1);
                        const y = Math.max(0, box.y - box.height * 0.1);
                        const width = Math.min(canvas.width - x, box.width * 1.2);
                        const height = Math.min(canvas.height - y, box.height * 1.2);
                        
                        // 獲取當前馬賽克大小並根據圖片大小調整
                        const baseMosaicSize = parseInt(document.getElementById('mosaicSize').value);
                        // 根據圖片大小調整馬賽克尺寸
                        const scaleFactor = Math.min(displayWidth, displayHeight) / 800; // 基準尺寸設為800px
                        const currentMosaicSize = Math.max(Math.round(baseMosaicSize * scaleFactor), 1);
                        
                        for (let px = x; px < x + width; px += currentMosaicSize) {
                            for (let py = y; py < y + height; py += currentMosaicSize) {
                                const pixelData = ctx.getImageData(
                                    Math.floor(px), 
                                    Math.floor(py), 
                                    1, 
                                    1
                                ).data;
                                ctx.fillStyle = `rgb(${pixelData[0]},${pixelData[1]},${pixelData[2]})`;
                                ctx.fillRect(
                                    Math.floor(px), 
                                    Math.floor(py), 
                                    currentMosaicSize, 
                                    currentMosaicSize
                                );
                            }
                        }
                    });

                    // 更新預覽圖片
                    const processedImage = new Image();
                    processedImage.src = canvas.toDataURL('image/jpeg');
                    
                    // 等待圖片加載完成
                    await new Promise((resolve) => {
                        processedImage.onload = resolve;
                    });
                    
                    // 更新 DOM
                    const imageItem = imageList.children[index];
                    if (imageItem) {
                        const processedImg = imageItem.querySelector('.preview-processed img');
                        if (processedImg) {
                            processedImg.src = processedImage.src;
                        }
                    }
                    
                    // 保存處理後的圖片
                    uploadedImages[index].processed = processedImage;
                    
                    console.log(`在圖片 ${imgData.name} 中偵測到 ${detections.length} 個人臉`);
                } else {
                    console.log(`在圖片 ${imgData.name} 中未偵測到人臉`);
                    alert(`在圖片 "${imgData.name}" 中未偵測到人臉，請確保人臉清晰可見`);
                }
            } catch (error) {
                console.error('處理圖片時發生錯誤:', error);
                throw error;
            }
        }

        // 使用多個模型進行人臉偵測
        async function detectFaces(image) {
            // 使用不同的模型和參數進行偵測
            const detectionsSSD = await faceapi.detectAllFaces(
                image,
                new faceapi.SsdMobilenetv1Options({ 
                    minConfidence: 0.3,
                    maxResults: 100 
                })
            ).withFaceLandmarks();

            const detectionsTiny = await faceapi.detectAllFaces(
                image,
                new faceapi.TinyFaceDetectorOptions({
                    inputSize: 512,
                    scoreThreshold: 0.3
                })
            ).withFaceLandmarks();

            // 合併兩個模型的結果
            let allDetections = [...detectionsSSD, ...detectionsTiny];

            // 移除重複的偵測結果
            allDetections = allDetections.filter((detection, index) => {
                const box = detection.detection.box;
                const center = { x: box.x + box.width/2, y: box.y + box.height/2 };
                
                // 檢查是否與之前的偵測結果重疊
                for (let i = 0; i < index; i++) {
                    const otherBox = allDetections[i].detection.box;
                    const otherCenter = { 
                        x: otherBox.x + otherBox.width/2, 
                        y: otherBox.y + otherBox.height/2 
                    };
                    
                    const distance = Math.sqrt(
                        Math.pow(center.x - otherCenter.x, 2) + 
                        Math.pow(center.y - otherCenter.y, 2)
                    );
                    
                    if (distance < (box.width + otherBox.width) / 4) {
                        return false; // 移除重複的偵測
                    }
                }
                
                return true;
            });

            return allDetections;
        }

        // 下載所有圖片的函數
        function downloadAllImages() {
            try {
                uploadedImages.forEach(imgData => {
                    if (imgData.processed) {
                        const link = document.createElement('a');
                        const fileName = imgData.name.replace(/\.[^/.]+$/, '') + '_mosaic.jpg';
                        link.download = fileName;
                        link.href = imgData.processed.src;
                        link.click();
                    }
                });
                hideCompletionModal();
            } catch (error) {
                console.error('下載圖片失敗:', error);
                alert('下載圖片失敗，請重試');
            }
        }

        // 綁定下載按鈕事件
        downloadBtn.addEventListener('click', downloadAllImages);
        modalDownloadBtn.addEventListener('click', downloadAllImages);

    } catch (error) {
        console.error('初始化失敗:', error);
        alert('初始化失敗，請確保網路連接正常並重新整理頁面');
    }
});
