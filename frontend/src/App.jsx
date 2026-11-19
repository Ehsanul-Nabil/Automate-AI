// import React, { useEffect } from 'react'
// import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
// import Login from './pages/Login'
// import Home from './pages/Home'
// import Agents from './pages/Agents'
// import Integration from './pages/Integration'
// import CreateAgent from './pages/CreateAgent'
// import { me } from './features/auth'
// import { useDispatch, useSelector } from 'react-redux'
// import { setUserData } from './redux/userSlice'
// import { setAgents, setAgentsLoading } from './redux/agentSlice'
// import { getAllAgents } from './features/agent'

// function App() {
//   const dispatch = useDispatch()

//   useEffect(() => {
//     const fetch = async () => {
//       try {
//         const data = await me()
//         dispatch(setUserData(data))
//         console.log(data)
//       } catch (error) {
//         console.log(error)
//       }
//     }
//     fetch()
//   }, [])

  
//   const fetchAgents = async () => {
//       dispatch(setAgentsLoading(true))
//     try {
//       const data = await getAllAgents()
//       dispatch(setAgents(data))
//       dispatch(setAgentsLoading(false))
//       console.log(data)
//     } catch (error) {
//       dispatch(setAgentsLoading(false))
//       console.log(error)
//     }
//   }

//   useEffect(()=>{
//     fetchAgents()
//   },[])

//   const { userData } = useSelector(state => state.user)
//   console.log("userData ",userData)

//   return (
//     <>
//       <BrowserRouter>
//         <Routes>
//           <Route path='/login' element={userData ? <Navigate to="/" /> : <Login />} />
//           <Route path='/' element={userData ? <Home /> : <Navigate to="/login" />} />
//           <Route path='/agents' element={userData ? <Agents /> : <Navigate to="/login" />} />
//           <Route path='/integrations' element={userData ? <Integration /> : <Navigate to="/login" />} />
//           <Route path='/agents/new' element={userData ? <CreateAgent /> : <Navigate to="/login" />} />
//         </Routes>
//       </BrowserRouter>
//     </>
//   )
// }

// export default App


import React, { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login'
import Home from './pages/Home'
import Agents from './pages/Agents'
import Integration from './pages/Integration'
import CreateAgent from './pages/CreateAgent'
import { me } from './features/auth'
import { useDispatch, useSelector } from 'react-redux'
import { setUserData } from './redux/userSlice'
import { setAgents, setAgentsLoading } from './redux/agentSlice'
import { getAllAgents } from './features/agent'

function App() {
  const dispatch = useDispatch()
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await me()
        dispatch(setUserData(data))
        console.log(data)
      } catch (error) {
        console.log(error)
      } finally {
        setAuthLoading(false)
      }
    }
    fetch()
  }, [])

  const fetchAgents = async () => {
    dispatch(setAgentsLoading(true))
    try {
      const data = await getAllAgents()
      dispatch(setAgents(data))
      dispatch(setAgentsLoading(false))
      console.log(data)
    } catch (error) {
      dispatch(setAgentsLoading(false))
      console.log(error)
    }
  }

  useEffect(() => {
    fetchAgents()
  }, [])

  const { userData } = useSelector(state => state.user)

  if (authLoading) {
    return null
  }

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path='/login' element={userData ? <Navigate to="/" /> : <Login />} />
          <Route path='/' element={userData ? <Home /> : <Navigate to="/login" />} />
          <Route path='/agents' element={userData ? <Agents /> : <Navigate to="/login" />} />
          <Route path='/integrations' element={userData ? <Integration /> : <Navigate to="/login" />} />
          <Route path='/agents/new' element={userData ? <CreateAgent /> : <Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App