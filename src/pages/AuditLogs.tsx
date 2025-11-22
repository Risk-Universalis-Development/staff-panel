import React, { useRef, useState, useEffect } from "react";
import "./AuditLogs.css"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger
} from "@/components/ui/select"

import { ChevronLeft, ChevronRight, Funnel, Logs, CirclePlus, ShieldUser } from 'lucide-react';

type AuditLog = {
    action_id: number;
    admin_roblox_name: string | null;
    admin_roblox_id: number;
    action: "ban" | "modify" | "unban";
    timestamp: number;
    player_roblox_name: string | null;
    player_roblox_id: number;
}

function formatUnixTimestamp(unix: number): string {
  const date = new Date(unix * 1000);

  const day = date.getDate();
  const month = date.toLocaleString("en-GB", { month: "long" });
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12; 

  return `${day}${getOrdinal(day)} ${month} ${year} ${hours}:${minutes}${ampm}`;
}

function getOrdinal(n: number): string {
  if (n > 3 && n < 21) return "th";
  switch (n % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

export default function AuditLogs() {

    const searchRef = useRef<HTMLInputElement>(null);
    const targetRef = useRef<HTMLInputElement>(null);
    const actionSelectedRef = useRef<HTMLInputElement>(null);
    const [currentPageNum, setCurrentPageNum] = useState<number>(1);
    const [loadingAuditLogs, setLoadingAuditLogs] = useState<boolean>(false);
    const [displayedAuditLogsList, setDisplayedAuditLogsList] = useState<AuditLog[] | null>(null);
    const [auditLogsReload] = useState<number>(new Date().getTime());
    const [maxPages, setMaxPages] = useState<number>(1);
    const [actionSelected, setActionSelected] = useState<"modify" | "ban" | "unban" | null>(null);
    const [adminSearchText, setAdminSearchText] = useState<string>("");
    const [targetSearchText, setTargetSearchText] = useState<string>("");

    const [userProfiles, setUserProfiles] = useState<Record<number, string>>({});

    function chunk<T>(arr: T[], size: number): T[][] {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
    }

    const uniqueUserIds = React.useMemo(() => {
        if (!displayedAuditLogsList) return [] as number[];
        const ids = new Set<number>();
        for (const b of displayedAuditLogsList) {
            ids.add(Number(b.admin_roblox_id)) 
            ids.add(Number(b.player_roblox_id)) 
        };
        return Array.from(ids);
    }, [displayedAuditLogsList]);

    React.useEffect(() => {
        if (!uniqueUserIds.length) return;

        const missing = uniqueUserIds.filter((id) => !(id in userProfiles));
        if (!missing.length) return;

        const controller = new AbortController();
        const limitPerCall = 50;
        const batches = chunk(missing, limitPerCall);

        (async () => {
            try {
                for (const batch of batches) {
                    const url =
                        `https://thumbnails.rotunnel.com/v1/users/avatar-headshot` +
                        `?userIds=${batch.join(",")}&size=150x150&format=Png&isCircular=false`;

                    const res = await fetch(url, { signal: controller.signal });
                    if (!res.ok) continue;

                    const json: {
                        data?: Array<{ targetId: number; state: string; imageUrl?: string }>;
                    } = await res.json();

                    if (!json?.data?.length) continue;

                    setUserProfiles((prev) => {
                        const next = { ...prev };
                        for (const id of batch) {
                            const item = json.data!.find((x) => x.targetId === id);
                            if (item && item.state === "Completed" && item.imageUrl) {
                                next[id] = item.imageUrl;
                            } else {
                                next[id] = "/no-profile.webp"; 
                            }
                        }
                        return next;
                    });
                }
            } catch (err) {
                if ((err as any).name !== "AbortError") {
                    console.error("Avatar fetch failed:", err);
                }
            }
        })();

        return () => controller.abort();
    }, [uniqueUserIds, userProfiles]);

    function loadAuditLogs(resetPage: boolean) {

        setLoadingAuditLogs(true);

        let url = `/api/get-audit-logs?limit=20&page=${currentPageNum}`

        if (resetPage) {
            url = `/api/get-audit-logs?limit=20&page=1`
        }

        if (adminSearchText) {
            url = `${url}&admin=${adminSearchText}`
        };

        if (targetSearchText) {
            url = `${url}&target=${targetSearchText}`
        };

        if (actionSelected) {
            url = `${url}&action=${actionSelected}`
        };

        fetch(url).then(response => {
            response.json().then(data => {

                if (!data.rows) {
                   setCurrentPageNum(1);
                   setMaxPages(1);
                   setLoadingAuditLogs(false);
                   return setDisplayedAuditLogsList([])
                };

                if (resetPage) {
                    setCurrentPageNum(1);
                }
                if (data.pageCount) {
                    setMaxPages(data.pageCount);
                };
                setLoadingAuditLogs(false);
                setDisplayedAuditLogsList(data.rows)

            }).catch(() => {
                setCurrentPageNum(1);
                setMaxPages(1);
                setLoadingAuditLogs(false);
                return setDisplayedAuditLogsList([])
            })
        }).catch(() => {
            setCurrentPageNum(1);
            setMaxPages(1);
            setLoadingAuditLogs(false);
            return setDisplayedAuditLogsList([])
        });
    };

    useEffect(() => {
        setCurrentPageNum(1);
        setMaxPages(1);
        setLoadingAuditLogs(true);
        loadAuditLogs(true);
    }, [auditLogsReload]); 

    useEffect(() => {

        setDisplayedAuditLogsList(null);

        const timeout = setTimeout(() => {
            setCurrentPageNum(1);
            setMaxPages(1);
            setLoadingAuditLogs(true);
            setDisplayedAuditLogsList(null);

            loadAuditLogs(true);
        }, 500);

        return () => clearTimeout(timeout);
    }, [adminSearchText, targetSearchText, actionSelected]);

    useEffect(() => {
        if (!displayedAuditLogsList || loadingAuditLogs) {
            return;
        }
        return loadAuditLogs(false)
    }, [currentPageNum])

    return <>

        <div className="p-[10px] w-full max-w-[1300px]" style={{"margin": "auto"}}>
            <div>
                <b className="text-[2rem] flex items-center gap-[10px]"><Logs className='text-[#fdfcc8]' size={"1.8rem"}/> Audit Logs</b>
            </div>
            <div className='audit-logs-search'>
                <ShieldUser style={{"cursor": "text"}} onClick={() => {
                    searchRef.current?.focus()
                }} className="absolute left-[18px] w-[1.3rem] mt-[-2px]"/>
                <input disabled={loadingAuditLogs} ref={searchRef} onChange={(e) => {
                    setAdminSearchText(e.target.value);
                }} type="text" placeholder="Search audit logs by admin" value={adminSearchText}/>
            </div>

            <div className='audit-logs-search'>
                <CirclePlus style={{"cursor": "text"}} onClick={() => {
                    targetRef.current?.focus()
                }} className="absolute left-[18px] w-[1.3rem] mt-[-2px]"/>
                <input disabled={loadingAuditLogs} ref={targetRef} onChange={(e) => {
                    setTargetSearchText(e.target.value);
                }} type="text" placeholder="Search audit logs by target" value={targetSearchText}/>
            </div>
            
            <div className="mt-[13px] pb-[10px]">
                <Select onValueChange={(e) => {
                    if (e == "ban" || e == "modify" || e == "unban") {
                        setActionSelected(e as "ban" | "modify" | "unban")
                    } else {
                        setActionSelected(null)
                    }
                }}>
                    <SelectTrigger  className="w-full" style={{"background": "transparent", "padding": "0px"}}>
                        <div className='audit-logs-search'>
                            <Funnel style={{"cursor": "text"}} onClick={() => {
                                actionSelectedRef.current?.focus()
                            }} className="absolute left-[18px] w-[1.3rem] mt-[-2px]"/>
                            <input disabled={loadingAuditLogs} ref={actionSelectedRef} type="text" placeholder="Filter by action" value={(!actionSelected ? "" : (actionSelected == "ban" ? "Ban" : (actionSelected == "modify" ? "Modify Ban" : "Unban")))}/>
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectLabel>Options</SelectLabel>
                            {
                                actionSelected ? <>
                                    <SelectItem value={"clear"}>
                                        Clear Selected
                                    </SelectItem>
                                </> : <></>
                            }
                            <SelectItem value={"ban"}>
                                Ban
                            </SelectItem>
                            <SelectItem value={"unban"}>
                                Unban
                            </SelectItem>
                            <SelectItem value={"modify"}>
                                Modify Ban
                            </SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>
            <div className="audit-logs-seperator mt-[20px]"></div>
            <div className="audit-logs-buttons items-center">
                <button disabled={loadingAuditLogs || currentPageNum <= 1} onClick={() => {
                    if (loadingAuditLogs || currentPageNum <= 1) {
                        return;
                    }
                    setCurrentPageNum((old) => {
                        return old - 1
                    })
                }} className="primary"><ChevronLeft/> Previous</button>
                <div className="text-[1rem] md:text-[1.4rem]">Page {currentPageNum.toString()}</div>
                <button disabled={loadingAuditLogs || currentPageNum >= maxPages} onClick={() => {
                    if (loadingAuditLogs || currentPageNum >= maxPages) {
                        return;
                    }
                    setCurrentPageNum((old) => {
                        return old + 1
                    })
                }} className="primary">Next <ChevronRight/></button>
            </div>
            <div className="audit-logs-page">
                {
                    displayedAuditLogsList ? <>
                        {
                            displayedAuditLogsList.map((action) => {
                                return <div key={action.action_id} className={`audit-logs`}>
                                    <div className="buttons">
                                        {
                                            userProfiles[action.admin_roblox_id] ? <>
                                                <img alt={action.admin_roblox_id + " Profile Image"} src={userProfiles[action.admin_roblox_id]}></img>
                                            </> : <>
                                                <div className="profile-image-load"></div>
                                            </>
                                        }
                                    </div>
                                    <div className="data">
                                        <div className="user-holder">
                                            <a className="username" href={`https://roblox.com/users/${action.admin_roblox_id}`} target="_blank">{action.admin_roblox_name}</a> <span className="id">({action.admin_roblox_id})</span>
                                        </div>
                                        <div>
                                            {
                                                action.action == "ban" ? <>
                                                    <b>{action.admin_roblox_name}</b>{" "}banned{" "}<b className="cursor-pointer hover:opacity-[0.7]" onClick={() => {
                                                        window.open(`https://www.roblox.com/users/${action.player_roblox_id}/profile`)
                                                    }}>{action.player_roblox_name}</b>
                                                </> : <></>
                                            }
                                            {
                                                action.action == "unban" ? <>
                                                    <b>{action.admin_roblox_name}</b>{" "}unbanned{" "}<b className="cursor-pointer hover:opacity-[0.7]" onClick={() => {
                                                        window.open(`https://www.roblox.com/users/${action.player_roblox_id}/profile`)
                                                    }}>{action.player_roblox_name}</b>
                                                </> : <></>
                                            }
                                            {
                                                action.action == "modify" ? <>
                                                    <b>{action.admin_roblox_name}</b>{" "}modified{" "}<b className="cursor-pointer hover:opacity-[0.7]" onClick={() => {
                                                        window.open(`https://www.roblox.com/users/${action.player_roblox_id}/profile`)
                                                    }}>{action.player_roblox_name}</b>'s{" "}ban!
                                                </> : <></>
                                            }
                                        </div>
                                        <div className="mt-[10px] opacity-[0.5] text-[0.8rem]">
                                            {formatUnixTimestamp(action.timestamp)}
                                        </div>
                                    </div>
                                </div>
                            })
                        }
                    </> : <>
                        Loading...
                    </>
                }
            </div>
        </div>
    </>
}
