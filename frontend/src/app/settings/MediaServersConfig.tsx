"use client";

import { useState, useEffect } from "react";
import ComponentLoader from "../componentLoader";
import OptionType from "./OptionType";
import { toast } from "react-hot-toast";
import * as MediaServersConfig from "../Actions/MediaServersConfig";
import { getApiUrl } from "../Actions/RestApiConfig";
import UsersComponent from "../components/UsersComponent";
import { User, UsersOrigin } from "../../../Props";

// You then access the exports as properties of that alias:
// MediaServersConfig.loadServers();
// MediaServersConfig.saveConfig();

export type Configuration = {
  [key: string]: any;
};


export default function RestApiConfiguration() {
    const [loadedPlexConfig, setLoadedPlexConfig] = useState<Configuration>({});
    const [plexConfig, setPlexConfig] = useState<Configuration>({});
    const [disabledPlexSave, setDisabledPlexSave] = useState(true);
    const [loadedJellyfinConfig, setLoadedJellyfinConfig] = useState<Configuration>({});
    const [jellyfinConfig, setJellyfinConfig] = useState<Configuration>({});
    const [disabledJellyfinSave, setDisabledJellyfinSave] = useState(true);
    const [plexloading, setPlexLoading] = useState(true);
    const [jellyfinloading, setJellyfinLoading] = useState(true);
    const [manageJellyfinUsers, setManageJellyfinUsers] = useState(false);

    useEffect(() => {
        setDisabledPlexSave(JSON.stringify(plexConfig) === JSON.stringify(loadedPlexConfig));
        setDisabledJellyfinSave(JSON.stringify(jellyfinConfig) === JSON.stringify(loadedJellyfinConfig));
    }, [jellyfinConfig, loadedJellyfinConfig, plexConfig, loadedPlexConfig]);
    
    const getPlex = async () => {
        const response = await MediaServersConfig.getPlexConfig();
        if (response.PLEX_SELECTION === "remote" && response.PLEX_URL && response.PLEX_URL.trim() !== "") {
            return { "plex_installed": response.PLEX_INSTALLED, "plex_selection": response.PLEX_SELECTION, "plex_url": response.PLEX_URL, "plex_url_port": response.PLEX_PORT || 32400 };
        }
        else{
            return { "plex_installed": response.PLEX_INSTALLED, "plex_selection": "local", "plex_url": `${await MediaServersConfig.getPlexUrl(window.location.hostname, window.location.protocol)}`, "plex_url_port": response.PLEX_PORT || 32400 };
        }
    };

    const getJellyfin = async () => {
        const response = await MediaServersConfig.getJellyfinConfig();
        if (response.JELLYFIN_SELECTION === "remote" && response.JELLYFIN_URL && response.JELLYFIN_URL.trim() !== "") {
            return { "jellyfin_installed": response.JELLYFIN_INSTALLED, "jellyfin_selection": response.JELLYFIN_SELECTION, "jellyfin_url": response.JELLYFIN_URL, "jellyfin_url_port": response.JELLYFIN_PORT || 8096 };
        }
        else{
            return { "jellyfin_installed": response.JELLYFIN_INSTALLED, "jellyfin_selection": "local", "jellyfin_url": `${await MediaServersConfig.getJellyfinUrl(window.location.hostname, window.location.protocol)}`, "jellyfin_url_port": response.JELLYFIN_PORT || 8096 };
        }
    };

    const savePlex = async () => {
        try{
        setPlexLoading(true);
        const { plex_installed: plexinstalled, plex_selection: plexoption, plex_url: plexurl, plex_url_port: plexurlport } = plexConfig;
        const plexUrl = plexoption === "remote" && plexurl && plexurl.trim() !== ""
            ? plexurl.trim().replace(/\/+$/, "")
            : `${window.location.protocol.replace(":", "")}://${window.location.hostname}:${plexurlport || 32400}`;
        const healthController = new AbortController();
        const healthTimeout = setTimeout(() => {
            healthController.abort();
        }, 2000);
        try {
            const healthResponse = await fetch(`${await getApiUrl(window.location.hostname, window.location.protocol)}/checkPlex?url=${encodeURIComponent(plexUrl)}`, {
                signal: healthController.signal,
            });
            if (!healthResponse.ok) {
                throw new Error(`Plex check failed with status ${healthResponse.status}`);
            }
        }
        finally {
            clearTimeout(healthTimeout);
        }

        if(plexoption === "remote" && plexurl && plexurl.trim() !== ""){
            const respone = await MediaServersConfig.savePlexConfig(plexoption, plexurl, null , plexinstalled);
            if (!respone.success) {
                throw new Error(respone.error || "Failed to save Plex configuration");
            }
        }
        else{
            const respone = await MediaServersConfig.savePlexConfig(plexoption, null, plexurlport, plexinstalled);
            if (!respone.success) {
                throw new Error(respone.error || "Failed to save Plex configuration");
            }
        }
        toast.success("Plex configuration saved successfully");
        setLoadedPlexConfig(plexConfig);
    } catch (error) {
        console.error("Error saving Plex configuration:", error);
        toast.error("Could not connect to Plex. Please check your Plex configuration.");
    } finally {
        setPlexLoading(false);
    }
    };

    const saveJellyfin = async () => {
        try{
        setJellyfinLoading(true);
        const { jellyfin_installed: jellyfininstalled, jellyfin_selection: jellyfinoption, jellyfin_url: jellyfinurl, jellyfin_url_port: jellyfinurlport} = jellyfinConfig;
        const jellyfinUrl = jellyfinoption === "remote" && jellyfinurl && jellyfinurl.trim() !== ""
            ? jellyfinurl.trim().replace(/\/+$/, "")
            : `${window.location.protocol.replace(":", "")}://${window.location.hostname}:${jellyfinurlport || 8096}`;
        const healthController = new AbortController();
        const healthTimeout = setTimeout(() => {
            healthController.abort();
        }, 2000);
        try {
            const healthResponse = await fetch(`${await getApiUrl(window.location.hostname, window.location.protocol)}/checkJellyfin?url=${encodeURIComponent(jellyfinUrl)}`, {
                signal: healthController.signal,
            });
            if (!healthResponse.ok) {
                throw new Error(`Jellyfin check failed with status ${healthResponse.status}`);
            }
        }
        finally {
            clearTimeout(healthTimeout);
        }

        if(jellyfinoption === "remote" && jellyfinurl && jellyfinurl.trim() !== ""){
            const respone = await MediaServersConfig.saveJellyfinConfig(jellyfinoption, jellyfinurl, null , jellyfininstalled);
            if (!respone.success) {
                throw new Error(respone.error || "Failed to save Jellyfin configuration");
            }
        }
        else{
            const respone = await MediaServersConfig.saveJellyfinConfig(jellyfinoption, null, jellyfinurlport, jellyfininstalled);
            if (!respone.success) {
                throw new Error(respone.error || "Failed to save Jellyfin configuration");
            }
        }
        toast.success("Jellyfin configuration saved successfully");
        setLoadedJellyfinConfig(jellyfinConfig);
    } catch (error) {
        console.error("Error saving Jellyfin configuration:", error);
        toast.error("Could not connect to Jellyfin. Please check your Jellyfin configuration.");
    } finally {
        setJellyfinLoading(false);
    }
    };

    const onUpdatePlexConfig = async (newValue : string) => {
            try{
                setPlexLoading(true);
                const respone = await MediaServersConfig.getPlexConfig();
                if (newValue == "remote"){

                    setPlexConfig({"plex_installed": plexConfig["plex_installed"], "plex_selection": newValue, "plex_url": respone.PLEX_URL, "plex_url_port": plexConfig["plex_url_port"] });
                }
                else{
                    setPlexConfig({"plex_installed": plexConfig["plex_installed"], "plex_selection": newValue, "plex_url": `${await MediaServersConfig.getPlexUrl(window.location.hostname, window.location.protocol, plexConfig["plex_url_port"])}`, "plex_url_port": plexConfig["plex_url_port"] });
                }
            }
            catch(error){
                console.error("Error updating Plex configuration:", error);
                toast.error("Error updating Plex configuration: " + (error instanceof Error ? error.message : ""));
            }
            finally{
                setPlexLoading(false);
            }
    }

    const onUpdateJellyfinConfig = async (newValue : string) => {
            try{
                setJellyfinLoading(true);
                const respone = await MediaServersConfig.getJellyfinConfig();
                if (newValue == "remote"){

                    setJellyfinConfig({"jellyfin_installed": jellyfinConfig["jellyfin_installed"], "jellyfin_selection": newValue, "jellyfin_url": respone.JELLYFIN_URL, "jellyfin_url_port": jellyfinConfig["jellyfin_url_port"] });
                }
                else{
                    setJellyfinConfig({"jellyfin_installed": jellyfinConfig["jellyfin_installed"], "jellyfin_selection": newValue, "jellyfin_url": `${await MediaServersConfig.getJellyfinUrl(window.location.hostname, window.location.protocol, jellyfinConfig["jellyfin_url_port"])}`, "jellyfin_url_port": jellyfinConfig["jellyfin_url_port"] });
                }
            }
            catch(error){
                console.error("Error updating Jellyfin configuration:", error);
                toast.error("Error updating Jellyfin configuration: " + (error instanceof Error ? error.message : ""));
            }
            finally{
                setJellyfinLoading(false);
            }
    }

    const onUpdatePlexPort = async (newValue : number) => {
        try{
            const respone = await MediaServersConfig.getPlexConfig();
            setPlexConfig({"plex_installed": respone.PLEX_INSTALLED, "plex_selection": "local", "plex_url": `${await MediaServersConfig.getPlexUrl(window.location.hostname, window.location.protocol, newValue)}`, "plex_url_port": newValue.toString() });
        }
        catch(error){
            console.error("Error updating Plex configuration port:", error);
            toast.error("Error updating Plex configuration port: " + (error instanceof Error ? error.message : ""));
        }
    }

    const onUpdateJellyfinPort = async (newValue : number) => {
        console.log("loadedJellyfinConfig:", loadedJellyfinConfig, "jellyfinConfig:", jellyfinConfig, "newValue:", newValue);
        try{
            const respone = await MediaServersConfig.getJellyfinConfig();
            setJellyfinConfig({"jellyfin_installed": respone.JELLYFIN_INSTALLED, "jellyfin_selection": "local", "jellyfin_url": `${await MediaServersConfig.getJellyfinUrl(window.location.hostname, window.location.protocol, newValue)}`, "jellyfin_url_port": newValue.toString() });
        }
        catch(error){
            console.error("Error updating Jellyfin configuration port:", error);
            toast.error("Error updating Jellyfin configuration port: " + (error instanceof Error ? error.message : ""));
        }
    }

    useEffect(() => {
        const fetchPlexConfig = async () => {
            setPlexLoading(true);
            try{
                const plexConfig = await getPlex();
                setLoadedPlexConfig(plexConfig);
                setPlexConfig(plexConfig);
            }
            catch(error){
                console.error("Error fetching Plex configuration:", error);
                toast.error("Error fetching Plex configuration: " + (error instanceof Error ? error.message : ""));
            }
            finally{
                setPlexLoading(false);
            }
        }
        const fetchJellyfinConfig = async () => {
            setJellyfinLoading(true);
            try{
                const jellyfinConfig = await getJellyfin();
                setLoadedJellyfinConfig(jellyfinConfig);
                setJellyfinConfig(jellyfinConfig);
            }
            catch(error){
                console.error("Error fetching Jellyfin configuration:", error);
                toast.error("Error fetching Jellyfin configuration: " + (error instanceof Error ? error.message : ""));
            }
            finally{
                setJellyfinLoading(false);
            }
        }
        fetchJellyfinConfig();
        fetchPlexConfig();
    }, []);

    const getJellyfinUsers : () => Promise<User[]> = async () => {
        try {
            const response = await `${await getApiUrl(window.location.hostname, window.location.protocol)}/getJellyfinUsers`;
            const users = await fetch(response);
            if (!users.ok) {
                throw new Error(`Failed to fetch Jellyfin users: ${users.statusText}`);
            }
            return (await users.json()).map((user: any) => ({
                id: user.Id,
                name: user.Name,
                type: user.Policy.IsAdministrator ? "Admin" : "User",
                username: user.Name,
                password: "", // Passwords are not retrievable for security reasons
            }));
        } catch (error) {
            console.error("Error fetching Jellyfin users:", error);
            toast.error("Error fetching Jellyfin users: " + (error instanceof Error ? error.message : ""));
            return [];
        }
    };





    const AddJellyfinUser : (username: string, password: string) => Promise<void> = async (username, password) => {
        try {
            const response = await fetch(`${await getApiUrl(window.location.hostname, window.location.protocol)}/addJellyfinUser`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ Name: username, password: password}),
            });
            if (!response.ok) {
                throw new Error(`Failed to add Jellyfin user: ${response.statusText}`);
            }
            toast.success(`User ${username} added successfully.`);
        } catch (error) {
            console.error("Error adding Jellyfin user:", error);
            toast.error("Error adding Jellyfin user: " + (error instanceof Error ? error.message : ""));
        }
    };

    const DeleteJellyfinUser : (id: string) => Promise<void> = async (id) => {
        try {
            const response = await fetch(`${await getApiUrl(window.location.hostname, window.location.protocol)}/deleteJellyfinUser/${id}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
            });
            if (!response.ok) {
                throw new Error(`Failed to delete Jellyfin user: ${response.statusText}`);
            }
            toast.success(`User ${id} deleted successfully.`);
        } catch (error) {
            console.error("Error deleting Jellyfin user:", error);
            toast.error("Error deleting Jellyfin user: " + (error instanceof Error ? error.message : ""));
        }
    };

    return (
    <div className="flex flex-col gap-4">
        <div className="relative">
            <div className="flex justify-between items-center mt-4">
                <h2 className="text-l font-bold text-zinc-100">Jellyfin Configuration</h2>
                <OptionType typeKey="jellyfin_installed" value={jellyfinConfig?.jellyfin_installed || false} type="<boolean>" onChange={(newValue) => setJellyfinConfig((prev) => ({ ...prev, "jellyfin_installed": newValue }))} />
            </div>
            {jellyfinConfig?.jellyfin_installed && (
            <div className="relative mt-4 pl-8 flex flex-col">
                <OptionType typeKey="jellyfin_selection" value={jellyfinConfig?.jellyfin_selection || "local"} type="<dropdown>" options={[{key: "local", value: "Local"}, {key: "remote", value: "Remote" }] } onChange={async (newValue) => {await onUpdateJellyfinConfig(newValue); setJellyfinConfig((prev) => ({ ...prev, "jellyfin_selection": newValue } ))}} />
                <OptionType asNumber={true} allHidden={jellyfinConfig["jellyfin_selection"] === "remote"} typeKey="jellyfin_url_port" value={jellyfinConfig["jellyfin_url_port"] || ""} type="<string>" onChange={async (newValue) => {await onUpdateJellyfinPort(newValue); setJellyfinConfig((prev) => ({ ...prev, "jellyfin_url_port": parseInt(newValue) }))}} />
                <OptionType disabled={jellyfinConfig["jellyfin_selection"] !== "remote"} typeKey="jellyfin_url" value={jellyfinConfig["jellyfin_url"] || ""} type="<string>" onChange={(newValue) => setJellyfinConfig((prev) => ({ ...prev, "jellyfin_url": newValue }))} />
                <OptionType typeKey="manage_jellyfin_users" type="<button>" value={null} onClick={async () => {setManageJellyfinUsers(true);}} icon="/manager-users.svg" iconClassName="w-5 h-5 ml-0.5" />
            </div>
            )}
            <div className="flex justify-end">
                <button onClick={saveJellyfin} disabled={disabledJellyfinSave} className="bg-blue-700 cursor-pointer enabled:hover:bg-blue-900 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed">Save</button>
            </div>
            {jellyfinloading && (
                <ComponentLoader  name="Jellyfin Configuration"/>
            )}
            
        </div>

        <div className="relative">
            <div className="flex justify-between items-center mt-4">
                <h2 className="text-l font-bold text-zinc-100">Plex Configuration</h2>
                <OptionType typeKey="plex_installed" value={plexConfig?.plex_installed || false} type="<boolean>" onChange={(newValue) => setPlexConfig((prev) => ({ ...prev, "plex_installed": newValue }))} />
            </div>
            {plexConfig?.plex_installed && (
            <div className="relative mt-4 pl-8 flex flex-col">
                <OptionType typeKey="plex_selection" value={plexConfig?.plex_selection || "local"} type="<dropdown>" options={[{key: "local", value: "Local"}, {key: "remote", value: "Remote" }] } onChange={async (newValue) => {await onUpdatePlexConfig(newValue); setPlexConfig((prev) => ({ ...prev, "plex_selection": newValue } ))}} />
                <OptionType asNumber={true} allHidden={plexConfig["plex_selection"] === "remote"} typeKey="plex_url_port" value={plexConfig["plex_url_port"] || ""} type="<string>" onChange={async (newValue) => {await onUpdatePlexPort(newValue); setPlexConfig((prev) => ({ ...prev, "plex_url_port": parseInt(newValue) }))}} />
                <OptionType disabled={plexConfig["plex_selection"] !== "remote"} typeKey="plex_url" value={plexConfig["plex_url"] || ""} type="<string>" onChange={(newValue) => setPlexConfig((prev) => ({ ...prev, "plex_url": newValue }))} />
            </div>
            )}
            <div className="flex justify-end">
                <button onClick={savePlex} disabled={disabledPlexSave} className="bg-blue-700 cursor-pointer enabled:hover:bg-blue-900 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed">Save</button>
            </div>
            {plexloading && (
                <ComponentLoader name="Plex Configuration"/>
            )}
            
        </div>
    {manageJellyfinUsers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setManageJellyfinUsers(false)}>
            <div className="bg-zinc-900 p-6 rounded-lg w-3/4 max-w-3xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Manage Jellyfin Users</h2>
                    <button 
                        onClick={() => setManageJellyfinUsers(false)}
                        className="text-zinc-400 hover:text-white font-bold cursor-pointer text-sm"
                    >
                        ✕
                    </button>
                </div>
                
                <UsersComponent GetUsers={getJellyfinUsers} DeleteUser={DeleteJellyfinUser} AddUser={AddJellyfinUser} origin={UsersOrigin.Jellyfin} /> 
            </div>
        </div>
    )}
    </div>
    );
}