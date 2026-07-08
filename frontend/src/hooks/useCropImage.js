import { useState } from "react"
import api from '../api'
import { buildModelWsUrl } from '../utils/ws'

export function useCropImage(image, bbox) {

    const [ isLoading, setIsLoading ] = useState(false);

    const startCropping = async () => {
        if(!image || !bbox || !bbox.x || !bbox.y || !bbox.width || !bbox.height) return
        setIsLoading(true)
        try {
            // Preparar a imagem e a bbox e colocá-los num formData
            const imageFetch = await fetch(image.src)
            const blob = await imageFetch.blob()
            const formData = new FormData()
            formData.append('image', blob)
            formData.append('bbox', JSON.stringify(bbox))

            const response = await api.post(import.meta.env.VITE_API_URL + '/api/crop/', formData)
            if(response.status != 200) throw new Error('Error starting the image cropping process')
            const taskId = response.data.task_id

            const socket = new WebSocket(buildModelWsUrl(taskId))

            return new Promise((resolve, reject) => {
                socket.onmessage = function(event) {
                    const data = JSON.parse(event.data)
                    console.log("Mensagem recebida do WebSocket:", data)
                    const resultsReady = data.results !== undefined
                    if(resultsReady) {
                        socket.close()
                        setIsLoading(false)
                        resolve(data.results)
                    }
                }
                socket.onerror = function(error) {
                    socket.close()
                    reject(error)
                }
                socket.onclose = function() {
                    console.log("Conexão WebSocket fechada.")
                }
            })
        } catch(error) {
            throw error
        }
    }

    return { isLoading, startCropping }
}
