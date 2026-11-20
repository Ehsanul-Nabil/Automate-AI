import api from "@/api"

export const chat = async (message) => {
    try {
        const { data } = await api.post("/api/chat", { message })
        return data
    } catch (error) {
        console.log(error)
        return (error)
    }
}

export const agentChat=async (message,agent)=>{
    try {
        const {data}=await api.post("/api/chat/agent",{message,agent})
        console.log(data)
        return data
    } catch (error) {
        console.log(error)
        return (error)
    }
}

export const agentResume = async ({approved, agent}) => {
  try {
    const { data } = await api.post("/api/chat/agent/resume", {
      agent,
      approved,
    });
    console.log(data);
    return data;
  } catch (error) {
    console.log(error);
    return error;
  }
};