import React, { useRef, useState, useEffect } from "react";
import "./BanManagement.css"

import { Gavel, UserRoundPlus, History, Search, ChevronLeft, ChevronRight, Wrench, Ban, Check, Link, LoaderCircle } from 'lucide-react';

import { format } from "date-fns";

type Ban = {
    ban_id: number;
    banned_user: string;
    banned_user_id: number;
    banned_by: string;
    reason: string;
    logsLink: string;
    expires: number | null;
    logged_at: number;
    appealable: number | boolean | null;
}

type BanUnit = "day" | "days" | "d" | "month" | "months" | "m" | "year" | "years" | "y" | "yr" | "yrs" | "ds" | "ms";

function safeFormat(date: Date) {
    try {
        const formatted = format(date, "PPP")
        return formatted
    } catch {
        return "Invalid Date"
    }
}

export default function BanManagement() {

    const searchRef = useRef<HTMLInputElement>(null);
    const [currentSearch, setCurrentSearch] = useState<string>("");
    const [currentPageNum, setCurrentPageNum] = useState<number>(1);
    const [loadingBans, setLoadingBans] = useState<boolean>(false);
    const [displayedBansList, setDisplayedBansList] = useState<Ban[] | null>(null);
    const [unappealableOnly, setUnappealableOnly] = useState<boolean>(false);
    const [bansReload, setBansReload] = useState<number>(new Date().getTime());
    const [maxPages, setMaxPages] = useState<number>(1);

    const [userProfiles, setUserProfiles] = useState<Record<number, string>>({});

    function chunk<T>(arr: T[], size: number): T[][] {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
    }

    const uniqueUserIds = React.useMemo(() => {
        if (!displayedBansList) return [] as number[];
        const ids = new Set<number>();
        for (const b of displayedBansList) ids.add(b.banned_user_id);
        return Array.from(ids);
    }, [displayedBansList]);

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

    function formatUnixTimestamp(unix: number): string {
        const date = new Date(unix * 1000); 
        const options: Intl.DateTimeFormatOptions = {
            month: "short",   
            day: "2-digit",  
            year: "numeric",  
            hour: "numeric",  
            minute: "2-digit" 
        };

        return date.toLocaleString("en-US", options);
    }

    function loadBans(resetPage: boolean) {

        setLoadingBans(true);

        let url = `/api/bans/get-all-bans?limit=15&page=${currentPageNum}&onlyUnappealables=${unappealableOnly ? "true" : "false"}`

        if (resetPage) {
            url = `/api/bans/get-all-bans?limit=15&page=${1}&onlyUnappealables=${unappealableOnly ? "true" : "false"}`
            if (currentSearch.trim().length > 0) {
                url = `/api/bans/search-bans/${currentSearch.trim()}?limit=15&page=${1}&onlyUnappealables=${unappealableOnly ? "true" : "false"}`
            };
        } else {
            if (currentSearch.trim().length > 0) {
                url = `/api/bans/search-bans/${currentSearch.trim()}?limit=15&page=${currentPageNum}&onlyUnappealables=${unappealableOnly ? "true" : "false"}`
            };
        };

        fetch(url).then(response => {
            response.json().then(data => {

                if (!data.rows) {
                   setCurrentPageNum(1);
                   setMaxPages(1);
                   setLoadingBans(false);
                   return setDisplayedBansList([])
                };

                if (resetPage) {
                    setCurrentPageNum(1);
                }
                if (data.pageCount) {
                    setMaxPages(data.pageCount);
                };
                setLoadingBans(false);
                setDisplayedBansList(data.rows)

            }).catch(() => {
                setCurrentPageNum(1);
                setMaxPages(1);
                setLoadingBans(false);
                return setDisplayedBansList([])
            })
        }).catch(() => {
            setCurrentPageNum(1);
            setMaxPages(1);
            setLoadingBans(false);
            return setDisplayedBansList([])
        });
    };

    useEffect(() => {
        setCurrentPageNum(1);
        setMaxPages(1);
        setLoadingBans(true);
        loadBans(true);
    }, [bansReload]); 

    useEffect(() => {
        const timeout = setTimeout(() => {
            setCurrentPageNum(1);
            setMaxPages(1);
            setLoadingBans(true);
            setDisplayedBansList(null);

            loadBans(true);
        }, 500);

        return () => clearTimeout(timeout);
    }, [currentSearch]);

    useEffect(() => {
        setCurrentPageNum(1);
        setMaxPages(1);
        setLoadingBans(true);
        setDisplayedBansList(null);
        loadBans(true);
    }, [unappealableOnly])

    useEffect(() => {
        if (!displayedBansList || loadingBans) {
            return;
        }
        return loadBans(false)
    }, [currentPageNum])

    const [newBanModalOpen, setNewBanModalOpen] = useState<boolean>(false);
    const [newBanReasons, setNewBanReasons] = useState<string[]>([]);
    const [newBanAdditional, setNewBanAdditional] = useState<string>("");
    const [newBanProfile, setNewBanProfile] = useState<string | null>(null);
    const [newBanUsername, setNewBanUsername] = useState<string>("");
    const [newBanUnappealable, setNewBanUnappealable] = useState<boolean>(false);
    const [newBanLogsLink, setNewBansLogLink] = useState<string>(""); 
    const [newBanText, setNewBanText] = useState<string>("");
    const [newBanDate, setNewBanDate] = useState<Date | undefined>(undefined);
    const [newBanSubmitting, setNewBanSubmitting] = useState<boolean>(false);
    const [newBanError, setNewBanError] = useState<string | null>(null);

    useEffect(() => {
        try {
            if (!newBanText.trim()) {
            setNewBanDate(undefined);
            return;
            }

            const regex = /^\s*(\d+)\s*(day|days|d|month|months|m|year|years|y|yr|ds|ms|yrs)\s*$/i;
            const match = newBanText.match(regex);

            if (!match) {
            setNewBanDate(undefined);
            return;
            }

            const amount = parseInt(match[1], 10);
            const unit = match[2].toLowerCase() as BanUnit;

            const now = new Date();
            const newDate = new Date(now);

            switch (unit) {
            case "day":
            case "days":
            case "d":
            case "ds":
                newDate.setDate(now.getDate() + amount);
                break;
            case "month":
            case "months":
            case "m":
            case "ms":
                newDate.setMonth(now.getMonth() + amount);
                break;
            case "year":
            case "years":
            case "y":
            case "yr":
            case "yrs":
                newDate.setFullYear(now.getFullYear() + amount);
                break;
            default:
                setNewBanDate(undefined);
                return;
            }

            setNewBanDate(newDate);
        } catch {
            setNewBanDate(undefined);
        }
    }, [newBanText]);

    useEffect(() => {

        if (!newBanModalOpen) {
            return;
        };

        setNewBanProfile(null);

        const timeout = setTimeout(() => {
            if (newBanUsername.trim().length <= 0) {
                setNewBanProfile(null);
                return;  
            };

            fetch(`/api/get-user-id/${newBanUsername.trim()}`).then(response => {
                response.json().then(data => {
                    if (!data || !data.success || !data.data) {
                        setNewBanProfile(null);
                        return;  
                    };
                    fetch(`https://thumbnails.rotunnel.com/v1/users/avatar-headshot?userIds=${data.data}&size=150x150&format=Png&isCircular=false`).then(response => {
                        response.json().then(data => {
                            if (!data || !data.data || !data.data[0] || !data.data[0].state || data.data[0].state !== "Completed" || !data.data[0].imageUrl) {
                                setNewBanProfile(null);
                                return;  
                            };
                            return setNewBanProfile(data.data[0].imageUrl);
                        }).catch(() => {
                            setNewBanProfile(null);
                            return;  
                        });
                    }).catch(() => {
                        setNewBanProfile(null);
                        return;  
                    })
                }).catch(() => {
                    setNewBanProfile(null);
                    return;  
                })
            })
        }, 1000);

        return () => clearTimeout(timeout);

    }, [newBanUsername]);

    const [modifyBanModalOpen, setModifyBanModalOpen] = useState<boolean>(false);
    const [modifyBanSubmitting, setModifyBanSubmitting] = useState<boolean>(false);
    const [modifyBanUsername, setModifyBanUsername] = useState<string>("");
    const [modifyBanId, setModifyBanId] = useState<number>(0);
    const [modifyBanReason, setModifyBanReason] = useState<string>("");
    const [modifyBanDateText, setModifyBanDateText] = useState<string>("");
    const [modifyBanDate, setModifyBanDate] = useState<Date | undefined>(undefined);
    const [modifyBanDeleting, setModifyBanDeleting] = useState<boolean>(false);
    const [modifyBanError, setModifyBanError] = useState<string | null>(null);

    useEffect(() => {
        try {
            if (!modifyBanDateText.trim()) {
            setModifyBanDate(undefined);
            return;
            }

            const regex = /^\s*(\d+)\s*(day|days|d|month|months|m|year|years|y|yr|ds|ms|yrs)\s*$/i;
            const match = modifyBanDateText.match(regex);

            if (!match) {
            setModifyBanDate(undefined);
            return;
            }

            const amount = parseInt(match[1], 10);
            const unit = match[2].toLowerCase() as BanUnit;

            const now = new Date();
            const newDate = new Date(now);

            switch (unit) {
            case "day":
            case "days":
            case "d":
            case "ds":
                newDate.setDate(now.getDate() + amount);
                break;
            case "month":
            case "months":
            case "m":
            case "ms":
                newDate.setMonth(now.getMonth() + amount);
                break;
            case "year":
            case "years":
            case "y":
            case "yr":
            case "yrs":
                newDate.setFullYear(now.getFullYear() + amount);
                break;
            default:
                setModifyBanDate(undefined);
                return;
            }

            setModifyBanDate(newDate);
        } catch {
            setModifyBanDate(undefined);
            setModifyBanDateText("");
        }
    }, [modifyBanDateText]);

    const [banHistoryModalOpen, setBanHistoryModalOpen] = useState<boolean>(false);
    const [banHistoryUsername, setBanHistoryUsername] = useState<string>("");
    const [banHistory, setBanHistory] = useState<Ban[] | null>(null);
    const [banHistoryIsBanned, setBanHistoryIsBanned] = useState<boolean | null>(null);
    const [banHistoryUserId, setBanHistoryUserId] = useState<number | null>(null);
    const [banHistoryProfileImage, setBanHistoryProfileImage] = useState<string | null>(null);

    useEffect(() => {

        if (!banHistoryModalOpen) {
            return;
        };

        setBanHistoryProfileImage(null);
        setBanHistoryUserId(null);
        setBanHistory(null);

        const timeout = setTimeout(() => {
            if (banHistoryUsername.trim().length <= 0) {
                setBanHistoryProfileImage(null);
                setBanHistoryUserId(null);
                setBanHistory(null);
                return;  
            };

            fetch(`/api/get-user-id/${banHistoryUsername.trim()}`).then(response => {
                response.json().then(data => {
                    if (!data || !data.success || !data.data) {
                        setBanHistoryProfileImage(null);
                        setBanHistoryUserId(null);
                        setBanHistory(null);
                        return;  
                    };
                    setBanHistoryUserId(data.data);
                    fetch(`https://thumbnails.rotunnel.com/v1/users/avatar-headshot?userIds=${data.data}&size=150x150&format=Png&isCircular=false`).then(response => {
                        response.json().then(data => {
                            if (!data || !data.data || !data.data[0] || !data.data[0].state || data.data[0].state !== "Completed" || !data.data[0].imageUrl) {
                                setBanHistoryProfileImage(null);
                                return;  
                            };
                            return setBanHistoryProfileImage(data.data[0].imageUrl);
                        }).catch(() => {
                            setBanHistoryProfileImage(null);
                            return;  
                        });
                    }).catch(() => {
                        setBanHistoryProfileImage(null);
                        return;  
                    })
                }).catch(() => {
                    setBanHistoryProfileImage(null);
                    setBanHistoryUserId(null);
                    return;  
                })
            })

            fetch(`/api/bans/get-ban-history/${banHistoryUsername.trim()}`).then(response => {
                response.json().then(data => {
                    if (!data) {
                        return;  
                    };
                    setBanHistoryIsBanned(data.isBanned);
                    setBanHistory(data.banHistory);
                })
            })
        }, 1000);

        return () => clearTimeout(timeout);

    }, [banHistoryUsername, banHistoryModalOpen]);

    return <>

        {
            newBanModalOpen && <>
                <div className="modal-holder" onClick={() => {

                    if (newBanSubmitting) {
                        return
                    };

                    setNewBanModalOpen(false);
                }}>
                    <div className="new-ban-modal" onClick={(e) => {
                        e.stopPropagation();
                    }}>
                        <div className="preview-section">
                            <b>Ban Preview</b>  
                            {
                                newBanProfile ? <>
                                    <img src={newBanProfile}></img>
                                </> : <>
                                    <div className="profile-image"></div>
                                </>
                            }
                            <a className={`${newBanSubmitting && "pointer-events-none opacity-[0.5]"}`} onClick={() => {

                                if (newBanSubmitting) {
                                    return;
                                };

                                setBanHistoryModalOpen(true);
                                setBanHistoryUsername(newBanUsername);
                                setBanHistoryIsBanned(null);
                                setBanHistory(null);
                            }}>View Ban History</a>
                        </div>
                        <div className="entry-section">
                            <div className="input">
                                <b>Username</b>
                                <input disabled={newBanSubmitting} value={newBanUsername} onChange={(e) => {
                                    setNewBanUsername(e.target.value);
                                }} placeholder="Enter Roblox Username..." type="text"/>
                            </div>
                            <div className="flex justify-between">
                                <div className="input" style={{"width": "fitContent"}}>
                                    <b>Reason(s)</b>
                                    <div className={`checkboxes ${newBanSubmitting && "pointer-events-none opacity-[0.5]"}`}>
                                        <div onClick={() => {
                                            setNewBanReasons((old) => {
                                                if (old.includes("Griefing")) {
                                                    return old.filter(value => value !== "Griefing");
                                                } else {
                                                    return [...old, "Griefing"];
                                                }
                                            });
                                        }} className={`checkbox-holder ${newBanReasons.includes("Griefing") && "checkbox-active"}`}>
                                            <div className="checkbox">
                                                <Check className="checkbox-fill"/>
                                            </div>
                                            <div>Griefing</div>
                                        </div>
                                        <div onClick={() => {
                                            setNewBanReasons((old) => {
                                                if (old.includes("Exploiting")) {
                                                    return old.filter(value => value !== "Exploiting");
                                                } else {
                                                    return [...old, "Exploiting"];
                                                }
                                            });
                                        }} className={`checkbox-holder ${newBanReasons.includes("Exploiting") && "checkbox-active"}`}>
                                            <div className="checkbox">
                                                <Check className="checkbox-fill"/>
                                            </div>
                                            <div>Exploiting</div>
                                        </div>
                                        <div onClick={() => {
                                            setNewBanReasons((old) => {
                                                if (old.includes("Trolling")) {
                                                    return old.filter(value => value !== "Trolling");
                                                } else {
                                                    return [...old, "Trolling"];
                                                }
                                            });
                                        }} className={`checkbox-holder ${newBanReasons.includes("Trolling") && "checkbox-active"}`}>
                                            <div className="checkbox">
                                                <Check className="checkbox-fill"/>
                                            </div>
                                            <div>Trolling</div>
                                        </div>
                                        <div  onClick={() => {
                                            setNewBanReasons((old) => {
                                                if (old.includes("Toxicity")) {
                                                    return old.filter(value => value !== "Toxicity");
                                                } else {
                                                    return [...old, "Toxicity"];
                                                }
                                            });
                                        }} className={`checkbox-holder ${newBanReasons.includes("Toxicity") && "checkbox-active"}`}>
                                            <div className="checkbox">
                                                <Check className="checkbox-fill"/>
                                            </div>
                                            <div>Toxicity</div>
                                        </div>
                                        <div  onClick={() => {
                                            setNewBanReasons((old) => {
                                                if (old.includes("TOS Violation")) {
                                                    return old.filter(value => value !== "TOS Violation");
                                                } else {
                                                    return [...old, "TOS Violation"];
                                                }
                                            });
                                        }} className={`checkbox-holder ${newBanReasons.includes("TOS Violation") && "checkbox-active"}`}>
                                            <div className="checkbox">
                                                <Check className="checkbox-fill"/>
                                            </div>
                                            <div>TOS Violation</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="input text-right" style={{"width": "calc(100% - 200px)"}}>
                                    <b>Additional</b>  
                                    <textarea className={`${newBanSubmitting && "pointer-events-none opacity-[0.5]"}`} disabled={newBanSubmitting} placeholder="Additional information..." onChange={(e) => {
                                        setNewBanAdditional(e.target.value)
                                    }} value={newBanAdditional}/>
                                </div>
                            </div>
                            <div className="input mt-[20px]">
                                <b>Logs Link</b>
                                <input disabled={newBanSubmitting}  value={newBanLogsLink} onChange={(e) => {
                                    setNewBansLogLink(e.target.value);
                                }} placeholder="Enter Discord Message Link..." type="text"/>
                            </div>
                            <div className="flex gap-[10px] flex-wrap">
                                <b>Unappealable: </b>
                                <div className={`toggle ${newBanUnappealable && "toggle-active"} ${newBanSubmitting && "pointer-events-none opacity-[0.5]"}`} onClick={() => {
                                    setNewBanUnappealable(old => {return !old});
                                }}>
                                    <div className="toggle-ball"></div>
                                </div>
                            </div>
                            <div className="input mt-[20px]">
                                <b>Ban Duration: </b>
                                <div>Currently: {newBanDate ? safeFormat(newBanDate) : "Permanent"}</div>
                                <input disabled={newBanSubmitting} value={newBanText} onChange={(e) => {
                                    setNewBanText(e.target.value);
                                }} placeholder="e.g. 1 day / 1 month / 1 year" type="text"/>
                                <div className="quick-dates">
                                    <button disabled={newBanSubmitting} onClick={() => {
                                        setNewBanText("7 days")
                                    }}>7 Days</button>
                                    <button disabled={newBanSubmitting} onClick={() => {
                                        setNewBanText("1 month")
                                    }}>1 Month</button>
                                    <button disabled={newBanSubmitting} onClick={() => {
                                        setNewBanText("6 months")
                                    }}>6 Month</button>
                                    <button disabled={newBanSubmitting} onClick={() => {
                                        setNewBanText("Permanent")
                                    }}>Permanent</button>
                                </div>
                            </div>
                            <div className="pb-[30px] publish-ban">
                                {
                                    newBanError ? <>
                                        <div className="mb-[15px] text-[0.9rem] text-[#ff5454]">* {newBanError}</div>
                                    </> : <></>
                                }
                                <button disabled={newBanSubmitting || !newBanUsername || (newBanReasons.length <= 0 && !newBanAdditional) || !newBanLogsLink} onClick={() => {
                                    if (newBanSubmitting || !newBanUsername || (newBanReasons.length <= 0 && !newBanAdditional) || !newBanLogsLink) {
                                        return;
                                    };

                                    setNewBanSubmitting(true);
                                    setNewBanError(null);

                                    let banReasonString = ``;

                                    if (newBanReasons.length <= 0) {
                                        banReasonString = newBanAdditional
                                    } else {
                                        banReasonString = `${newBanReasons.join("; ")}; ${newBanAdditional}`
                                    };

                                    banReasonString = banReasonString.trim();

                                    if (!banReasonString) {
                                        return setTimeout(() => {
                                            setNewBanSubmitting(false);
                                            setNewBanError("You must enter a valid ban reason!");
                                        }, 300);
                                    };

                                    if (!newBanUsername.trim()) {
                                        return setTimeout(() => {
                                            setNewBanSubmitting(false);
                                            setNewBanError("You must enter a valid Roblox username to ban!");
                                        }, 300);
                                    }

                                    if (!newBanLogsLink.trim()) {
                                        return setTimeout(() => {
                                            setNewBanSubmitting(false);
                                            setNewBanError("You must enter a valid logs link!");
                                        }, 300);
                                    }

                                    fetch("/api/bans/post-ban", {
                                        "method": "POST",
                                        "headers": {
                                            "content-type": "application/json"
                                        },
                                        "body": JSON.stringify({
                                            "user": newBanUsername,
                                            "reason": banReasonString,
                                            "logsLink": newBanLogsLink,
                                            "expiresIn": !newBanDate ? null : Math.floor(newBanDate.getTime() / 1000),
                                            "appealable": !newBanUnappealable
                                        })
                                    }).then(response => {
                                        response.json().then(async data => {
                                            if (response.status == 201 || response.status == 200) {
                                                await new Promise((resolve: any) => {
                                                    setTimeout(() => {
                                                        return resolve();
                                                    }, 1000);
                                                });
                                                setBansReload(new Date().getTime())
                                                setLoadingBans(true);
                                                setNewBanModalOpen(false);
                                                setDisplayedBansList(null);
                                                setCurrentPageNum(1);
                                                setCurrentSearch("");
                                                setMaxPages(1);
                                                return setTimeout(() => {
                                                    loadBans(true);
                                                }, 300);
                                            } else {
                                                if (data.message) {
                                                    setNewBanSubmitting(false);
                                                    return setNewBanError(data.message);
                                                } else {
                                                    setNewBanSubmitting(false);
                                                    return setNewBanError("An unexpected error occured, please try again!");
                                                };
                                            };
                                        }).catch(() => {
                                            setNewBanSubmitting(false);
                                            return setNewBanError("An unexpected error occured, please try again!");
                                        })
                                    }).catch(() => {
                                        setNewBanSubmitting(false);
                                        return setNewBanError("An unexpected error occured, please try again!");
                                    })

                                }}>{newBanSubmitting ? <><LoaderCircle className="animate-spin"/></> : <>Submit Ban</>}</button>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        }

        {
            modifyBanModalOpen && <>
                <div className="modal-holder" onClick={() => {

                    if (modifyBanSubmitting || modifyBanDeleting) {
                        return
                    };

                    setModifyBanModalOpen(false);
                }}>
                    <div className="modify-ban-modal" onClick={(e) => {
                        e.stopPropagation();
                    }}>
                        <div className="mb-[10px]">
                            <b className="text-[1.3rem]">Modify Ban</b>  
                        </div>
                        <div className="flex gap-[10px]">
                            {
                                userProfiles[modifyBanId] != null ? <>
                                    <img src={userProfiles[modifyBanId]}></img>
                                </> : <>
                                    <div className="profile-image"></div>
                                </>
                            }
                            <div>
                                <div className="user-holder">
                                    <a className="username" href={`https://roblox.com/users/${modifyBanId}`} target="_blank">{modifyBanUsername}</a> <span className="id">({modifyBanId})</span>
                                </div>
                            </div>
                        </div>
                        <div className="input mt-[20px]">
                            <b>Reason</b>  
                            <textarea className={`${modifyBanSubmitting && "pointer-events-none opacity-[0.5]"}`} disabled={modifyBanSubmitting} placeholder="Ban reason..." onChange={(e) => {
                                setModifyBanReason(e.target.value)
                            }} value={modifyBanReason}/>
                        </div>
                        <div className="input">
                            <b>Ban Duration: </b>
                            <div>Currently: {modifyBanDate ? safeFormat(modifyBanDate) : "Permanent"}</div>
                            <input disabled={modifyBanSubmitting} value={modifyBanDateText} onChange={(e) => {
                                setModifyBanDateText(e.target.value);
                            }} placeholder="e.g. 1 day / 1 month / 1 year" type="text"/>
                            <div className="quick-dates">
                                <button disabled={modifyBanSubmitting} onClick={() => {
                                    setModifyBanDateText("14 days")
                                }}>14 Days</button>
                                <button disabled={modifyBanSubmitting} onClick={() => {
                                    setModifyBanDateText("1 month")
                                }}>1 Month</button>
                                <button disabled={modifyBanSubmitting} onClick={() => {
                                    setModifyBanDateText("6 months")
                                }}>6 Month</button>
                                <button disabled={modifyBanSubmitting} onClick={() => {
                                    setModifyBanDateText("Permanent")
                                }}>Permanent</button>
                            </div>
                        </div>
                        <div className="pb-[30px] update-ban">
                            {
                                modifyBanError ? <>
                                    <div className="mb-[15px] text-[0.9rem] text-[#ff5454]">* {modifyBanError}</div>
                                </> : <></>
                            }
                            <div className="flex gap-[20px] mt-[20px]">
                                <button disabled={modifyBanSubmitting || modifyBanDeleting || !modifyBanUsername || modifyBanReason.length <= 0} onClick={() => {
                                    if (modifyBanSubmitting || modifyBanDeleting || !modifyBanUsername || modifyBanReason.length <= 0) {
                                        return;
                                    };

                                    setModifyBanSubmitting(true);
                                    setModifyBanDeleting(false);
                                    setModifyBanError(null);

                                    let banReasonString = modifyBanReason.trim();

                                    if (!banReasonString) {
                                        return setTimeout(() => {
                                            setModifyBanSubmitting(false);
                                            setModifyBanError("You must enter a valid ban reason!");
                                        }, 300);
                                    };

                                    fetch(`/api/bans/modify-ban/${modifyBanUsername}`, {
                                        "method": "PATCH",
                                        "headers": {
                                            "content-type": "application/json"
                                        },
                                        "body": JSON.stringify({
                                            "reason": banReasonString,
                                            "expiration": !modifyBanDate ? null : Math.floor(modifyBanDate.getTime() / 1000),
                                        })
                                    }).then(response => {
                                        response.json().then(async data => {
                                            if (response.status == 201 || response.status == 200) {
                                                await new Promise((resolve: any) => {
                                                    setTimeout(() => {
                                                        return resolve();
                                                    }, 1000);
                                                });
                                                setBansReload(new Date().getTime())
                                                setLoadingBans(true);
                                                setModifyBanSubmitting(false);
                                                setDisplayedBansList(null);
                                                setCurrentPageNum(1);
                                                setCurrentSearch("");
                                                setMaxPages(1);
                                                return setTimeout(() => {
                                                    loadBans(true);
                                                }, 300);
                                            } else {
                                                if (data.message) {
                                                    setModifyBanSubmitting(false);
                                                    return setModifyBanError(data.message);
                                                } else {
                                                    setModifyBanSubmitting(false);
                                                    return setModifyBanError("An unexpected error occured, please try again!");
                                                };
                                            };
                                        }).catch(() => {
                                            setModifyBanSubmitting(false);
                                            return setModifyBanError("An unexpected error occured, please try again!");
                                        })
                                    }).catch(() => {
                                        setModifyBanSubmitting(false);
                                        return setModifyBanError("An unexpected error occured, please try again!");
                                    })

                                }}>{modifyBanSubmitting ? <><LoaderCircle className="animate-spin"/></> : <>Submit Changes</>}</button>
                                <button className="unban-button" disabled={modifyBanSubmitting || modifyBanDeleting || !modifyBanUsername} onClick={() => {
                                    if (modifyBanSubmitting || modifyBanDeleting || !modifyBanUsername) {
                                        return;
                                    };

                                    setModifyBanSubmitting(false);
                                    setModifyBanDeleting(true);
                                    setModifyBanError(null);

                                    fetch(`/api/bans/delete-ban/${modifyBanUsername}`, {
                                        "method": "DELETE"
                                    }).then(response => {
                                        response.json().then(async data => {
                                            if (response.status == 201 || response.status == 200) {
                                                await new Promise((resolve: any) => {
                                                    setTimeout(() => {
                                                        return resolve();
                                                    }, 1000);
                                                });
                                                setBansReload(new Date().getTime())
                                                setLoadingBans(true);
                                                setModifyBanDeleting(false);
                                                setModifyBanModalOpen(false);
                                                setDisplayedBansList(null);
                                                setCurrentPageNum(1);
                                                setCurrentSearch("");
                                                setMaxPages(1);
                                                return setTimeout(() => {
                                                    loadBans(true);
                                                }, 300);
                                            } else {
                                                if (data.message) {
                                                    setModifyBanDeleting(false);
                                                    return setModifyBanError(data.message);
                                                } else {
                                                    setModifyBanDeleting(false);
                                                    return setModifyBanError("An unexpected error occured, please try again!");
                                                };
                                            };
                                        }).catch(() => {
                                            setModifyBanDeleting(false);
                                            return setModifyBanError("An unexpected error occured, please try again!");
                                        })
                                    }).catch(() => {
                                        setModifyBanDeleting(false);
                                        return setModifyBanError("An unexpected error occured, please try again!");
                                    })
                                }}>{modifyBanDeleting ? <><LoaderCircle className="animate-spin"/></> : <>Unban</>}</button>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        }

        {
            banHistoryModalOpen && <>
                <div className="modal-holder" onClick={() => {
                    setBanHistoryModalOpen(false);
                }}>
                    <div className="ban-history-modal" onClick={(e) => {
                        e.stopPropagation();
                    }}>
                        <div className="mb-[10px]">
                            <b className="text-[1.3rem]">Ban History</b>  
                        </div>
                        <div className="input">
                            <b>Username</b>
                            <input value={banHistoryUsername} onChange={(e) => {
                                setBanHistoryUsername(e.target.value);
                            }} placeholder="Enter Roblox Username..." type="text"/>
                        </div>
                        <div className="mt-[10px] mb-[10px] h-[1px]" style={{"backgroundColor": "rgba(255, 255, 255, 0.1)"}}></div>
                        {
                            banHistoryUsername.trim().length != 0 ? <>
                                {
                                    banHistory ? <>
                                        <div className="flex gap-[10px]">
                                            {
                                                banHistoryProfileImage ? <>
                                                    <img src={banHistoryProfileImage}></img>
                                                </> : <>
                                                    <div className="profile-image"></div>
                                                </>
                                            }
                                            <div>
                                                <div className="user-holder">
                                                    <a className="username" href={`https://roblox.com/users/${banHistoryUserId}`} target="_blank">{banHistoryUsername}</a> <span className="id">({banHistoryUserId})</span>
                                                </div>
                                                <div className="flex items-center gap-[10px] flex-wrap">
                                                    <b>Currently Banned: </b> { banHistoryIsBanned ? <><b><Check color="#fa5757"/></b></> : <><b><Ban color="#68fa57"/></b></> }
                                                </div>
                                            </div>
                                        </div>


                                        <div className="mt-[20px]">
                                            <b className="text-[1.2rem]">Prior Offences:</b>
                                        </div>
                                        {
                                            banHistory.length == 0 ? <>
                                                <div className="mt-[10px]">This user has no prior criminal record.</div>
                                            </> : <>
                                                {
                                                    banHistory.map((history) => {
                                                        return <div className="mt-[10px] pt-[10px] pb-[10px] mb-[10px]" style={{"borderTop": "1px solid rgba(255, 255, 255, 0.1)"}} key={history.ban_id}>
                                                            { !history.expires ? <>Banned permanently on {safeFormat(new Date(history.logged_at * 1000))} by {history.banned_by} for {history.reason} - ban was{history.appealable ? " appealable " : " not appealable"}.</> : <></> }

                                                            { history.expires ? <>Banned permanently on {safeFormat(new Date(history.logged_at * 1000))} for {Math.floor(Number(history.expires - history.logged_at) / 86400)} days by {history.banned_by} for {history.reason} - ban was{history.appealable ? " appealable " : " not appealable"}.</> : <></> }
                                                        </div>
                                                    })
                                                }
                                            </>
                                        }
                                    </> : <>
                                        Loading...
                                    </>
                                }
                            </> : <>
                                <div className="mt-[20px]">Please enter a username to see criminal record!</div>
                            </>
                        }
                    </div>
                </div>
            </>
        }

        <div className="p-[10px] w-full max-w-[1300px]" style={{"margin": "auto"}}>
            <div>
                <b className="text-[2rem] flex items-center gap-[10px]"><Gavel className='text-[#fdfcc8]' size={"1.8rem"}/> Ban Management</b>
            </div>
            <div className='ban-buttons'>
                <button className="primary" onClick={() => {
                    setNewBanModalOpen(true);
                    setNewBanProfile(null);
                    setNewBanUsername("");
                    setNewBanReasons([]);
                    setNewBanAdditional("");
                    setNewBansLogLink("");
                    setNewBanUnappealable(false);
                    setNewBanText("");
                    setNewBanError("");
                    setNewBanSubmitting(false);
                }}>New Ban <UserRoundPlus/></button>
                <button onClick={() => {
                    setBanHistoryModalOpen(true);
                    setBanHistoryUsername("");
                    setBanHistoryIsBanned(null);
                    setBanHistory(null);
                }}>View History <History /></button>
            </div>
            <div className='ban-search'>
                <Search style={{"cursor": "text"}} onClick={() => {
                    searchRef.current?.focus()
                }} className="absolute left-[18px] w-[1.3rem] mt-[-2px]"/>
                <input disabled={loadingBans} ref={searchRef} onChange={(e) => {
                    setCurrentSearch(e.target.value);
                }} type="text" placeholder="Search bans by username" value={currentSearch}/>
            </div>
            <div className="flex items-center gap-[20px] ban-search-filter">
                <b>Unappealable Only: </b>
                <div className={`toggle ${unappealableOnly && "toggle-active"}`} onClick={() => {

                    if (loadingBans) {
                        return;
                    }

                    setUnappealableOnly(old => {return !old});
                }}>
                    <div className="toggle-ball"></div>
                </div>
            </div>
            <div className="ban-seperator"></div>
            <div className="ban-buttons items-center">
                <button disabled={loadingBans || currentPageNum <= 1} onClick={() => {
                    if (loadingBans || currentPageNum <= 1) {
                        return;
                    }
                    setCurrentPageNum((old) => {
                        return old - 1
                    })
                }} className="primary"><ChevronLeft/> Previous</button>
                <div className="text-[1rem] md:text-[1.4rem]">Page {currentPageNum.toString()}</div>
                <button disabled={loadingBans || currentPageNum >= maxPages} onClick={() => {
                    if (loadingBans || currentPageNum >= maxPages) {
                        return;
                    }
                    setCurrentPageNum((old) => {
                        return old + 1
                    })
                }} className="primary">Next <ChevronRight/></button>
            </div>
            <div className="bans-page">
                {
                    displayedBansList ? <>
                        {
                            displayedBansList.map((ban) => {
                                return <div key={ban.ban_id} className={`ban ${(!ban.appealable && ban.appealable !== null) ? "unappealable-ban" : ""}`}>
                                    <div className="buttons">
                                        {
                                            userProfiles[ban.banned_user_id] ? <>
                                                <img alt={ban.banned_user + " Profile Image"} src={userProfiles[ban.banned_user_id]}></img>
                                            </> : <>
                                                <div className="profile-image-load"></div>
                                            </>
                                        }
                                        <button onClick={() => {
                                            setModifyBanModalOpen(true);
                                            
                                            if (!ban.expires) {
                                                setModifyBanDateText("");
                                            } else {
                                                try {
                                                    const days = Math.ceil((ban.expires - Math.floor(new Date().getTime() / 1000)) / 86400);
                                                    setModifyBanDateText(`${days} days`);
                                                } catch {
                                                    setModifyBanDateText(``);
                                                }
                                            };
                                            
                                            setModifyBanUsername(ban.banned_user);
                                            setModifyBanId(ban.banned_user_id);
                                            setModifyBanReason(ban.reason);
                                            setModifyBanSubmitting(false);
                                        }}><Wrench size={"1rem"}/> Modify</button>
                                        {
                                            ban.logsLink ? <>
                                                <button onClick={() => {
                                                    window.open(ban.logsLink)
                                                }}><Link size={"1rem"}/> Log</button>
                                            </> : <></>
                                        }
                                    </div>
                                    <div className="data">
                                        <div className="user-holder">
                                            <a className="username" href={`https://roblox.com/users/${ban.banned_user_id}`} target="_blank">{ban.banned_user}</a> <span className="id">({ban.banned_user_id})</span>
                                        </div>
                                        <a onClick={() => {
                                            setBanHistoryModalOpen(true);
                                            setBanHistoryUsername(ban.banned_user);
                                            setBanHistoryIsBanned(null);
                                            setBanHistory(null);
                                        }}>View Ban History</a>
                                        <div className="ban-data">
                                            <b>Issued by:</b> {ban.banned_by}
                                        </div>
                                        <div className="ban-data">
                                            <b>Timestamp:</b> {formatUnixTimestamp(ban.logged_at)}
                                        </div>
                                        <div className="ban-data">
                                            <b>Expires:</b> {ban.expires != null ? <>{formatUnixTimestamp(ban.expires)}</> : <>Permanent</>}
                                        </div>
                                        <div className="ban-data">
                                            <b>Reason:</b> {ban.reason ? ban.reason : "No Reason Provided"}
                                        </div>
                                        <div className="ban-data">
                                            <b>Appealable:</b> {(ban.appealable || ban.appealable == null) ? <><b><Check color="#68fa57"/></b></> : <><b><Ban color="#fa5757"/></b></>}
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