import React, { useRef, useState, useEffect } from "react";
import "./PlaytimeTracker.css"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger
} from "@/components/ui/select"

import { Timer, Search, ChevronLeft, ChevronRight, Funnel, CalendarDays } from 'lucide-react';

const ranks = [
    {
        name: "Experienced Participant",
        color: "#6cd94e",
        id: 5
    },
    {
        name: "Trusted Participant",
        color: "#4ed988ff",
        id: 8
    },
    {
        name: "Gamemaster",
        color: "#4ec4d9ff",
        id: 9
    },
    {
        name: "Trial Moderator",
        color: "#d9b44eff",
        id: 10
    },
    {
        name: "Moderator",
        color: "#e0982cff",
        id: 20
    },
    {
        name: "Senior Moderator",
        color: "#d94e4eff",
        id: 30
    },
    {
        name: "Retired Staff",
        color: "#fd7979ff",
        id: 31
    },
    {
        name: "Respected Peer",
        color: "#ffe89eff",
        id: 32
    },
    {
        name: "Administrator",
        color: "#ff3f3fff",
        id: 40
    },
    {
        name: "Head Administrator",
        color: "#b323cfff",
        id: 50
    },
    {
        name: "Developer",
        color: "#e658c2ff",
        id: 103
    },
    {
        name: "Executive",
        color: "#882383ff",
        id: 104
    },
    {
        name: "Head Developer",
        color: "#232a88ff",
        id: 105
    },
    {
        name: "Founder",
        color: "#2b80ffff",
        id: 255
    }
]

type Playtime = {
    userid: number;
    "sum(time)": number;
    role: string;
    username: string;
}

function getRoleColor(roleName: string) {
    const rank = ranks.find(r => r.name.trim().toLowerCase() === roleName.trim().toLowerCase());
    if (!rank) {
        return "#919191"
    };

    return rank.color
}   

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0 seconds";

  const units = [
    //{ label: "day", seconds: 86400 },
    { label: "hour", seconds: 3600 },
    { label: "minute", seconds: 60 },
    { label: "second", seconds: 1 },
  ];

  const parts: string[] = [];

  for (const unit of units) {
    const value = Math.floor(seconds / unit.seconds);
    if (value > 0) {
      parts.push(`${value} ${unit.label}${value !== 1 ? "s" : ""}`);
      seconds %= unit.seconds;
    }
  }

  return parts.join(", ");
}

export default function PlaytimeTracker() {

    const searchRef = useRef<HTMLInputElement>(null);
    const rankFilterRef = useRef<HTMLInputElement>(null);
    const [currentSearch, setCurrentSearch] = useState<string>("");
    const [currentPageNum, setCurrentPageNum] = useState<number>(1);
    const [loadingPlaytime, setLoadingPlaytime] = useState<boolean>(false);
    const [displayedPlaytimeList, setDisplayedPlaytimeList] = useState<Playtime[] | null>(null);
    const [playtimeReload] = useState<number>(new Date().getTime());
    const [maxPages, setMaxPages] = useState<number>(1);
    const [daysType, setDaysType] = useState<"7" | "30">("30");
    const [rankId, setRankId] = useState<number | null>(null);
    const [rankName, setRankName] = useState<string>("");

    useEffect(() => {
        if (!rankId) {
            return setRankName("")
        } else {
            const rank = ranks.find(r => r.id === rankId);
            if (!rank) {
                return setRankName("")
            };
            // setCurrentSearch("");
            return setRankName(rank.name)
        };
    }, [rankId])

    // useEffect(() => {
    //     if (currentSearch.trim().length > 0) {
    //         setRankId(null);
    //     };
    // }, [currentSearch])

    const [userProfiles, setUserProfiles] = useState<Record<number, string>>({});

    function chunk<T>(arr: T[], size: number): T[][] {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
    }

    const uniqueUserIds = React.useMemo(() => {
        if (!displayedPlaytimeList) return [] as number[];
        const ids = new Set<number>();
        for (const b of displayedPlaytimeList) ids.add(Number(b.userid));
        return Array.from(ids);
    }, [displayedPlaytimeList]);

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

    function loadPlaytimes(resetPage: boolean) {

        setLoadingPlaytime(true);

        let url = `/api/playtime/get-playtimes?limit=15&page=${currentPageNum}&days=${daysType}`

        if (resetPage) {
            url = `/api/playtime/get-playtimes?limit=15&page=${1}&days=${daysType}`
            if (currentSearch.trim().length > 0) {
                url = `/api/playtime/search-playtimes/${currentSearch.trim()}?limit=15&page=${1}&days=${daysType}`
            };
        } else {
            if (currentSearch.trim().length > 0) {
                url = `/api/playtime/search-playtimes/${currentSearch.trim()}?limit=15&page=${currentPageNum}&days=${daysType}`
            };
        };

        if (rankId) {
            url = `${url}&rankId=${rankId}`
        }

        fetch(url).then(response => {
            response.json().then(data => {

                if (!data.rows) {
                   setCurrentPageNum(1);
                   setMaxPages(1);
                   setLoadingPlaytime(false);
                   return setDisplayedPlaytimeList([])
                };

                if (resetPage) {
                    setCurrentPageNum(1);
                }
                if (data.pageCount) {
                    setMaxPages(data.pageCount);
                };
                setLoadingPlaytime(false);
                setDisplayedPlaytimeList(data.rows)

            }).catch(() => {
                setCurrentPageNum(1);
                setMaxPages(1);
                setLoadingPlaytime(false);
                return setDisplayedPlaytimeList([])
            })
        }).catch(() => {
            setCurrentPageNum(1);
            setMaxPages(1);
            setLoadingPlaytime(false);
            return setDisplayedPlaytimeList([])
        });
    };

    useEffect(() => {
        setCurrentPageNum(1);
        setMaxPages(1);
        setLoadingPlaytime(true);
        loadPlaytimes(true);
    }, [playtimeReload]); 

    useEffect(() => {

        setDisplayedPlaytimeList(null);

        const timeout = setTimeout(() => {
            setCurrentPageNum(1);
            setMaxPages(1);
            setLoadingPlaytime(true);
            setDisplayedPlaytimeList(null);

            loadPlaytimes(true);
        }, 500);

        return () => clearTimeout(timeout);
    }, [currentSearch, rankId, daysType]);

    useEffect(() => {
        if (!displayedPlaytimeList || loadingPlaytime) {
            return;
        }
        return loadPlaytimes(false)
    }, [currentPageNum])

    return <>

        <div className="p-[10px] w-full max-w-[1300px]" style={{"margin": "auto"}}>
            <div>
                <b className="text-[2rem] flex items-center gap-[10px]"><Timer className='text-[#fdfcc8]' size={"1.8rem"}/> Playtime Tracker</b>
            </div>
            <div className='playtime-search'>
                <Search style={{"cursor": "text"}} onClick={() => {
                    searchRef.current?.focus()
                }} className="absolute left-[18px] w-[1.3rem] mt-[-2px]"/>
                <input disabled={loadingPlaytime} ref={searchRef} onChange={(e) => {
                    setCurrentSearch(e.target.value);
                }} type="text" placeholder="Search playtime by username" value={currentSearch}/>
            </div>
            <div className="mt-[10px] pb-[10px]">
                <Select onValueChange={(e) => {
                    try {
                        if (e && Number(e)) {
                            setRankId(Number(e));
                        } else {
                            setRankId(null)
                        };
                    } catch {
                        setRankId(null)
                    }
                }}>
                    <SelectTrigger className="w-full" style={{"background": "transparent", "padding": "0px"}}>
                        <div className='playtime-search'>
                            <Funnel className="absolute left-[18px] w-[1.3rem] mt-[-2px]"/>
                            <input disabled={loadingPlaytime} ref={rankFilterRef} type="text" placeholder="Filter by rank" value={rankName} readOnly={true}/>
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                        {
                            rankId !== null ? <>
                                <SelectItem value={"Clear"}>
                                    <div className="h-[15px] w-[15px] rounded-full" style={{"backgroundColor": "grey"}}></div> <b>Clear Rank Filter</b>
                                </SelectItem>
                                <SelectLabel></SelectLabel>
                            </> : <></>
                        }
                        <SelectLabel>Ranks</SelectLabel>
                        {
                            ranks.map((rank) => {
                                return <SelectItem key={rank.name} value={rank.id.toString()}>
                                    <div className="h-[15px] w-[15px] rounded-full" style={{"backgroundColor": rank.color}}></div>
                                    {rank.name}
                                </SelectItem>
                            })
                        }
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>
            <div className="mt-[13px] pb-[10px]">
                <Select onValueChange={(e) => {
                    setDaysType(e as "30" | "7");
                }}>
                    <SelectTrigger  className="w-full" style={{"background": "transparent", "padding": "0px"}}>
                        <div className='playtime-search'>
                            <CalendarDays style={{"cursor": "text"}} onClick={() => {
                                rankFilterRef.current?.focus()
                            }} className="absolute left-[18px] w-[1.3rem] mt-[-2px]"/>
                            <input disabled={loadingPlaytime} ref={rankFilterRef} onChange={(e) => {
                                setCurrentSearch(e.target.value);
                            }} type="text" placeholder="Filter by rank" value={daysType + " Days"}/>
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectLabel>Options</SelectLabel>
                            <SelectItem value={"30"}>
                                30 Days
                            </SelectItem>
                            <SelectItem value={"7"}>
                                7 Days
                            </SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>
            <div className="playtime-seperator mt-[20px]"></div>
            <div className="playtime-buttons items-center">
                <button disabled={loadingPlaytime || currentPageNum <= 1} onClick={() => {
                    if (loadingPlaytime || currentPageNum <= 1) {
                        return;
                    }
                    setCurrentPageNum((old) => {
                        return old - 1
                    })
                }} className="primary"><ChevronLeft/> Previous</button>
                <div className="text-[1rem] md:text-[1.4rem]">Page {currentPageNum.toString()}</div>
                <button disabled={loadingPlaytime || currentPageNum >= maxPages} onClick={() => {
                    if (loadingPlaytime || currentPageNum >= maxPages) {
                        return;
                    }
                    setCurrentPageNum((old) => {
                        return old + 1
                    })
                }} className="primary">Next <ChevronRight/></button>
            </div>
            <div className="playtime-page">
                {
                    displayedPlaytimeList ? <>
                        {
                            displayedPlaytimeList.map((playtime) => {
                                return <div key={playtime.userid} className={`playtime`}>
                                    <div className="buttons">
                                        {
                                            userProfiles[playtime.userid] ? <>
                                                <img alt={playtime.userid + " Profile Image"} src={userProfiles[playtime.userid]}></img>
                                            </> : <>
                                                <div className="profile-image-load"></div>
                                            </>
                                        }
                                    </div>
                                    <div className="data">
                                        <div className="user-holder">
                                        {/*Note to self -- this is the playtime element thing*/}
                                            <a className="username" href={`https://roblox.com/users/${playtime.userid}`} target="_blank">{playtime.username}</a> <span className="id">({playtime.userid})</span>
                                        </div>
                                        <div>
                                            <b style={{"color": getRoleColor(playtime.role)}}>{playtime.role}</b>
                                        </div>
                                        <div className="mt-[10px]">
                                            Played for <b>{formatDuration(playtime["sum(time)"])}</b> in the past {daysType} days
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
