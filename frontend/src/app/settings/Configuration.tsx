"use client";
import {useState,useEffect} from "react";
import ComponentLoader from "../componentLoader";
import OptionType from "./OptionType";
import { toast } from "react-hot-toast";
// import { saveRestApiConfig, getRestApiConfig } from "../Actions/RestApiConfig";
import { getApiUrl } from "../Actions/RestApiConfig";
export type Configuration = {
  [key: string]: any;
};


export default function Configuration() {

    const saveConfiguration = async () => {
        if (disabledSave) return;
        if (!config || Object.keys(config).length === 0) return;
        
        try{
            setLoading(true);
            const response = await fetch(await getApiUrl(window.location.hostname, window.location.protocol) + "/updateConfiguration", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(config)
            });
            if (!response.ok) {
                throw new Error((await response.json()).error || "Failed to save configuration");
            }
            setLoadedConfig(config);
        }
        catch(error){
            console.error("Error saving configuration:", error);
            toast.error("Error saving configuration: " + (error instanceof Error ? error.message : ""));
        }    
        finally{
                setLoading(false);
        }
    };
    const [loadedConfig, setLoadedConfig] = useState<Configuration>({});
    const [config, setConfig] = useState<Configuration>({});
    const [disabledSave, setDisabledSave] = useState(true);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        setDisabledSave(JSON.stringify(config) === JSON.stringify(loadedConfig));
    }, [config, loadedConfig]);

    useEffect(() => {
        const fetchConfiguration = async () => {
            setLoading(true); 
            try{
                const res = await fetch(await getApiUrl(window.location.hostname, window.location.protocol) + "/getConfiguration");
                const data = await res.json();
                setLoadedConfig(data);
                setConfig(data);
            }
            catch(error){
                console.error("Error fetching configuration:", error);
                toast.error("Error fetching configuration: " + (error instanceof Error ? error.message : ""));
            }
            finally{
                setLoading(false);
            }
        }
        fetchConfiguration();
    }, []);


    return (
        <div className="relative mt-4 flex flex-col">
            <OptionType typeKey="MoviesFolder" value={config["MoviesFolder"] || ""} type="<Folder>" onChange={(newValue) => setConfig((prev) => ({ ...prev, MoviesFolder: newValue }))} />
            <OptionType typeKey="TVShowsFolder" value={config["TVShowsFolder"] || ""} type="<Folder>" onChange={(newValue) => setConfig((prev) => ({ ...prev, TVShowsFolder: newValue }))} />
            <OptionType typeKey="StremioFolder" value={config["StremioFolder"] || ""} type="<Folder>" onChange={(newValue) => setConfig((prev) => ({ ...prev, StremioFolder: newValue }))} />
            <OptionType minWidth="40vw" typeKey="DBConnectionString" value={config["DBConnectionString"] || ""} type="<string>" onChange={(newValue) => setConfig((prev) => ({ ...prev, DBConnectionString: newValue }))} />
            

            <div className="flex justify-end">
                <button onClick={saveConfiguration} disabled={disabledSave} className="bg-blue-700 cursor-pointer enabled:hover:bg-blue-900 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed">Save</button>
            </div>
            {loading && <ComponentLoader name="Configuration" />}
        </div>
    );
}