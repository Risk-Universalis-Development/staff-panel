import { useState, useEffect } from 'react'

import { Gavel, Timer, Logs, Menu, X } from 'lucide-react';

import './App.css'
import BanManagement from './pages/BanManagement';
import PlaytimeTracker from './pages/PlaytimeTracker';
import AuditLogs from './pages/AuditLogs';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type PageOption = "ban_management" | "playtime_tracker" | "audit_logs";

type AuthRes = {
    "rankid": number,
    "rank": string,
    "username": string,
    "robloxid": number,
    "discordid": string
}

function App() {

    const [authRobloxProfileImage, setAuthRobloxProfileImage] = useState<string | null>(null);
    const [currentAuth, setCurrentAuth] = useState<AuthRes | null>(null);

    useEffect(() => {
        if (!currentAuth || !currentAuth.robloxid || authRobloxProfileImage) {
            return;
        };
        fetch(`https://thumbnails.roproxy.com/v1/users/avatar-headshot?userIds=${currentAuth.robloxid}&size=150x150&format=Png&isCircular=false`).then(response => {
            response.json().then(data => {
                if (!data || !data.data || !data.data[0] || !data.data[0].state || data.data[0].state !== "Completed" || !data.data[0].imageUrl) {
                    return;
                };
                return setAuthRobloxProfileImage(data.data[0].imageUrl);
            }).catch(() => {});
        }).catch(() => {})
    }, [authRobloxProfileImage, currentAuth]) 

    useEffect(() => {

        if (currentAuth) {
            return;
        };

        fetch("/api/auth").then(response => {
            response.json().then(data => {
                if (!data.success || !data.data) {
                    return location.href = "/login";
                };
                setCurrentAuth(data.data);
            }).catch(() => {
                return location.href = "/login";
            })
        }).catch(() => {
            return location.href = "/login";
        })
    }, [currentAuth]);

    const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
    const [selectedPage, setSelectedPage] = useState<PageOption>("ban_management");

  return (
    <>
      <div className={`mobile-nav ${mobileNavOpen && "mobile-nav-open"}`}>
        <a className={selectedPage == "ban_management" ? "active" : ""} onClick={() => {
            setSelectedPage("ban_management");
            setMobileNavOpen(false);
        }}><Gavel/> Ban Management</a>
        <a className={selectedPage == "playtime_tracker" ? "active" : ""} onClick={() => {
            setSelectedPage("playtime_tracker");
            setMobileNavOpen(false);
        }}><Timer /> Playtime Tracker</a>
        <a className={selectedPage == "audit_logs" ? "active" : ""} onClick={() => {
            setSelectedPage("audit_logs");
            setMobileNavOpen(false);
        }}><Logs /> Audit Logs</a>
        <DropdownMenu>
            <DropdownMenuTrigger style={{"outline": "none", "border": "none", "padding": "0px", "background": "transparent"}}>
                <a className='user-nav'>
                    <div className='details'>
                        {
                            authRobloxProfileImage ? <>
                                <img src={authRobloxProfileImage || ""}></img>
                            </> : <>
                            </>
                        }
                        <div className='text'>
                            <div>{currentAuth?.username}</div>
                            <b>{currentAuth?.rank}</b>
                        </div>
                    </div>
                    <Menu className='opacity-[0.5]'/>
                </a>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={"end"}>
                <DropdownMenuItem className='cursor-pointer' onClick={() => {
                    window.open(`https://roblox.com/users/${currentAuth?.robloxid}`)
                }}>Open Roblox Profile</DropdownMenuItem>
                <DropdownMenuItem className='cursor-pointer' onClick={() => {
                    location.href = "/api/logout"
                }}>Logout</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className='nav'>
        <div className='nav-content'>
          <a className='branding' href="/"><img src={"/full-logo.png"} alt="Risk Universalis Logo"></img></a>
          <div className='links desktop-links'>
            <a className={selectedPage == "ban_management" ? "active" : ""} onClick={() => {
                setSelectedPage("ban_management");
            }}><Gavel/> Ban Management</a>
            <a className={selectedPage == "playtime_tracker" ? "active" : ""} onClick={() => {
                setSelectedPage("playtime_tracker");
            }}><Timer /> Playtime Tracker</a>
            <a className={selectedPage == "audit_logs" ? "active" : ""} onClick={() => {
                setSelectedPage("audit_logs");
            }}><Logs /> Audit Logs</a>
            <DropdownMenu>
                <DropdownMenuTrigger style={{"outline": "none", "border": "none", "padding": "0px", "background": "transparent"}}>
                    <a className='user-nav'>
                        <div className='details'>
                            <div className='text'>
                                <div>{currentAuth?.username}</div>
                                <b>{currentAuth?.rank}</b>
                            </div>
                            {
                                authRobloxProfileImage ? <>
                                    <img src={authRobloxProfileImage || ""}></img>
                                </> : <>
                                </>
                            }
                        </div>
                    </a>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem className='cursor-pointer' onClick={() => {
                        window.open(`https://roblox.com/users/${currentAuth?.robloxid}`)
                    }}>Open Roblox Profile</DropdownMenuItem>
                    <DropdownMenuItem className='cursor-pointer' onClick={() => {
                        location.href = "/api/logout"
                    }}>Logout</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className='links mobile-links'>
            {
                mobileNavOpen ? <>
                    <X onClick={() => {
                        setMobileNavOpen(false);
                    }} className='button'/>
                </> : <>
                    <Menu onClick={() => {
                        setMobileNavOpen(true);
                    }} className='button'/>
                </>
            }
          </div>
        </div>
      </div>
      <div className='page-holder'>
        <div className='page'>
          {
            selectedPage == "ban_management" && <BanManagement/>
          }
          {
            selectedPage == "playtime_tracker" && <PlaytimeTracker/>
          }
          {
            selectedPage == "audit_logs" && <AuditLogs/>
          }
        </div>
      </div>
    </>
  )
}

export default App
