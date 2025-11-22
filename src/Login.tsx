import { useEffect } from 'react'

import './App.css'

import { FaDiscord } from "react-icons/fa";

function Login() {

  useEffect(() => {
    fetch("/api/auth").then(response => {
      response.json().then(data => {
        if (data.success) {
          location.href = "/";
        };
      }).catch(() => {})
    }).catch(() => {})
  }, []);

  return (
    <>
      <div className='nav'>
        <div className='nav-content'>
          <a className='branding' href="/"><img src={"/full-logo.png"} alt="Risk Universalis Logo"></img></a>
          <div className='links'>
            <button className='discord-button' onClick={() => {
              location.href = "/api/login"
            }}><FaDiscord size={"20px"}/> Login</button>
          </div>
        </div>
      </div>
      <div className='page-holder'>
        <div className='page'>
          <div className='w-full h-full flex items-center justify-center'>
            <div className='login-box'>
              <div className='w-full flex justify-center pb-[40px] pt-[20px]'>
                <img className='h-[60px]' src={"/full-logo.png"} alt="Risk Universalis Logo"></img>
              </div>
              <div className='border-left'>
                <h1>Login</h1>
                <p>Welcome to the <b>Risk Universalis staff portal</b>, please login using Discord to gain access.</p>
              </div>
              <button className='discord-button w-full mt-[30px] mb-[20px]' onClick={() => {
                location.href = "/api/login"
              }}><FaDiscord size={"20px"}/> Login with Discord</button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default Login
