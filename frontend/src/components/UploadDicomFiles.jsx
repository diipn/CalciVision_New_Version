import React, { createRef, useEffect, useRef, useState } from 'react'
import api from '../api'

// Importar e iniciar instâncias do cornerstone e dicomparser para visualizar DICOMs no frontend
import * as cornerstone from 'cornerstone-core'
import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader'
import * as dicomParser from 'dicom-parser'
import AlertDialogMenu from './AlertDialogMenu'

cornerstoneWADOImageLoader.external.cornerstone = cornerstone
cornerstoneWADOImageLoader.external.dicomParser = dicomParser

cornerstoneWADOImageLoader.webWorkerManager.initialize({
  webWorkerPath: '/cornerstoneWADOImageLoaderWebWorker.js',
  taskConfiguration: {
    decodeTask: {
      codecsPath: '/cornerstoneWADOImageLoaderCodecs.js',
    },
  },
})

export default function UploadDicomFile({ patientId, reloadTable }) {
  const [dicomFiles, setDicomFiles] = useState([])
  const [loadingUpload, setLoadingUpload] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const alertTriggerRef = useRef(null)
  const canvasRefs = useRef([])

  useEffect(() => {
    dicomFiles.forEach((file, index) => {
        const imageId = cornerstoneWADOImageLoader.wadouri.fileManager.add(file)
        const element = canvasRefs.current[index]
        if (!element) return

        cornerstone.enable(element)

        cornerstone.loadImage(imageId).then(image => {
            const viewport = cornerstone.getDefaultViewportForImage(element, image)

            // Calcula fator de escala para caber em 64x64
            const scaleX = 72 / image.width
            const scaleY = 72 / image.height
            viewport.scale = Math.min(scaleX, scaleY)

            cornerstone.displayImage(element, image)
            cornerstone.setViewport(element, viewport)
        })
    })
  }, [dicomFiles])

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files)
    setDicomFiles(prev => [...prev, ...files])
    canvasRefs.current = [...canvasRefs.current, ...files.map(() => createRef())]
    e.target.value = null
  }

  const handleRemoveFile = (index) => {
    setDicomFiles(prev => {
      const updatedFiles = [...prev]
      updatedFiles.splice(index, 1)
      return updatedFiles
    })
    canvasRefs.current.splice(index, 1)
  }

  const handleUploadFiles = async () => {
    if(dicomFiles.length === 0) return
    setLoadingUpload(true)
    try {
      const data = new FormData()
      dicomFiles.forEach((file) => data.append('echoDicom', file))
      const response = await api.post(`/api/patient/${patientId}/echocardiogram/add/`, data)
      setLoadingUpload(false)
      setAlertMessage(
        response.status === 201
        ? 'DICOM file(s) succesfully uploaded'
        : `There was an error while uploading or processing the DICOM file(s). ${response.data.errors}`
      )
      alertTriggerRef.current?.click()
      setDicomFiles([])
      canvasRefs.current = []
      reloadTable()
    } catch(error) {
      console.error('Error uploading DICOMs', error)
    }
  }

  return (
    <>
      <AlertDialogMenu
        heading='DICOM Upload Status'
        content={alertMessage}
        hasCancel={false}
        confirmText='OK'
        onConfirm={() => {}}
      >
        {/* Trigger invisível */}
        <button
          ref={alertTriggerRef}
          className='hidden'
          aria-hidden='true'
          tabIndex={-1}
        />
      </AlertDialogMenu>
        
        {dicomFiles.length > 0 ? (
          <div className='mt-5 mb-3'>
              <p>Upload patient DICOM files here.</p>
              <div className='flex gap-2 mt-2 mb-3'>
                  {dicomFiles.map((file, index) =>
                      <div key={index} className='relative flex flex-col items-center gap-2 w-18 h-18 rounded-md'>
                          <div
                              ref={el => canvasRefs.current[index] = el}
                              className="w-full h-full border border-gray-300 rounded-md overflow-hidden"
                          />
                          <p className="absolute bottom-0 left-0 px-1 text-white text-xs max-w-18 text-center truncate">{file.name}</p>
                          <div 
                              className='absolute top-[6px] right-[6px] w-4 h-4 grid place-items-center rounded-full bg-gray-medium-dark/60 cursor-pointer'
                              onClick={() => handleRemoveFile(index)}
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" width={12} height={12} viewBox="0 0 24 24"><path fill="#ffffff" d="m12 13.4l-4.9 4.9q-.275.275-.7.275t-.7-.275t-.275-.7t.275-.7l4.9-4.9l-4.9-4.9q-.275-.275-.275-.7t.275-.7t.7-.275t.7.275l4.9 4.9l4.9-4.9q.275-.275.7-.275t.7.275t.275.7t-.275.7L13.4 12l4.9 4.9q.275.275.275.7t-.275.7t-.7.275t-.7-.275z"></path></svg>
                          </div>
                      </div>
                  )}
                  <label className='grid place-items-center w-18 h-18 rounded-md border border-dashed text-4xl cursor-pointer'>
                      +
                      <input
                          type='file'
                          accept='.dcm,application/dicom'
                          multiple
                          onChange={handleFileChange}
                          className='hidden'
                      />
                  </label>
              </div>
              <p>{dicomFiles.name}</p>
              <button 
                className='bg-green min-w-24 h-8 text-white rounded-md cursor-pointer grid place-items-center' 
                onClick={handleUploadFiles}
                type='submit'
              >
                {loadingUpload ? (
                  <span role='status' className='relative z-5 size-4 rounded-full border-3 border-gray-pale border-t-green-dark animate-spin' />
                ) : (
                  "Upload"
                )}
              </button>
          </div>
        ) : (
          <label className='flex gap-2 w-fit bg-green-dark rounded-lg py-1 px-4 mt-5 text-white cursor-pointer'>
            <svg xmlns='http://www.w3.org/2000/svg' width={22} height={22} viewBox='0 0 24 24'>
              <path fill='currentColor' d='M11 16V7.85l-2.6 2.6L7 9l5-5l5 5l-1.4 1.45l-2.6-2.6V16zm-5 4q-.825 0-1.412-.587T4 18v-3h2v3h12v-3h2v3q0 .825-.587 1.413T18 20z'></path>
            </svg>
            Upload DICOM
            <input
              type='file'
              accept='.dcm,application/dicom'
              multiple
              onChange={handleFileChange}
              className='hidden'
            />
          </label>
        )}
    </>
  )
}
