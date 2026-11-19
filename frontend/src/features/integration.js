export const connectGoogle=async ()=>{
    try {
        const {data}=await api.get("/api/integrations/google/connect")

        return data
    } catch (error) {
        console.log(error)
        return (error)
    }
}

export const connectInstagram=async ()=>{
    try {
        const {data}=await api.get("/api/integrations/instagram/connect")

        return data
    } catch (error) {
        console.log(error)
        return (error)
    }
}

export const disconnectGoogle=async ()=>{
    try {
        const {data}=await api.get("/api/integrations/google/disconnect")

        return data
    } catch (error) {
        console.log(error)
        return (error)
    }
}

export const disconnectInstagram=async ()=>{
    try {
        const {data}=await api.get("/api/integrations/instagram/disconnect")

        return data
    } catch (error) {
        console.log(error)
        return (error)
    }
}