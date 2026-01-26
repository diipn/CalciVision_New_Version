import React from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, FreeMode } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/free-mode'
import 'swiper/css/navigation'

function AnnotationToolSlider({ frames, rects, currentFrame, setCurrentFrame, batchStatus }) {

  return (
    <div className='w-full pl-2 pr-2 m-auto'>
        <Swiper
          slidesPerView={6}
          spaceBetween={10}
          slidesPerGroup={6}
          speed={600}
          slidesOffsetBefore={50}
          slidesOffsetAfter={50}
          navigation={true}
          freeMode={true}
          modules={[Navigation, FreeMode]}
          className='w-full h-full pt-2! pb-2!'
        >
            {frames.map((img, index) => {
                const isImageSelected = currentFrame === index

                const imageName = img.name
                const isLoading = batchStatus?.[imageName]?.status === 'PROGRESS'

                return (
                    <SwiperSlide key={index} className='flex justify-center items-center cursor-pointer'>
                        <div 
                            className={`relative w-20 h-20 rounded-md overflow-hidden ${isImageSelected ? 'outline-4 outline-white -outline-offset-4' : ''}`}
                            onClick={() => setCurrentFrame(index)}
                        >
                            {/* Imagem de ecocardiografia */}
                            <img 
                                src={img.url} 
                                alt={`Frame ${index + 1}`} 
                                className='w-full h-full object-cover' 
                            />
                            {/* Ícone de lápis se a imagem estiver a ser editada */}
                            {isImageSelected && (
                                <div className='absolute top-2 right-2'>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="white" d="M10.529 1.764a2.621 2.621 0 1 1 3.707 3.707l-.779.779L9.75 2.543zM9.043 3.25L2.657 9.636a2.96 2.96 0 0 0-.772 1.354l-.87 3.386a.5.5 0 0 0 .61.608l3.385-.869a2.95 2.95 0 0 0 1.354-.772l6.386-6.386z"/></svg>
                                </div>
                            )}
                            {/* Miniaturas das anotações */}
                            {rects[index]?.map((rect, rectIndex) => {
                                // Calcula as proporções corretas baseadas no tamanho da imagem
                                const imgElement = document.querySelector(`.swiper-slide:nth-child(${index + 1}) img`);
                                const imgWidth = imgElement?.naturalWidth || 1;
                                const imgHeight = imgElement?.naturalHeight || 1;
                                return (
                                    <div 
                                        key={rectIndex}
                                        className='absolute border border-yellow/80 bg-yellow/20'
                                        style={{
                                            left: `${(rect.x / imgWidth) * 100}%`,
                                            top: `${(rect.y / imgHeight) * 100}%`,
                                            width: `${(rect.width / imgWidth) * 100}%`,
                                            height: `${(rect.height / imgHeight) * 100}%`,
                                        }}
                                    />
                                )
                            })}
                            {isLoading && (
                                <div className='absolute inset-0 flex flex-col justify-center items-center'>
                                    <span role='status' className='relative z-5 w-8 h-8 rounded-full border-3 border-gray-pale border-t-blue-800 animate-spin' />
                                    <div className='absolute inset-0 bg-green-400/10 backdrop-blur-xs rounded-md' />
                                </div>
                            )}
                        </div>
                    </SwiperSlide>
                )
            })}
        </Swiper>
    </div>
  )
}

export default AnnotationToolSlider
