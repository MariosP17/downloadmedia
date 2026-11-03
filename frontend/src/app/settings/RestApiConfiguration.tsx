"use client";

import { useState, useEffect } from "react";
import ComponentLoader from "../componentLoader";
import OptionType from "./OptionType";
import { toast } from "react-hot-toast";
import { getApiUrl,getRestApiConfig, saveRestApiConfig } from "../Actions/RestApiConfig";

export type Configuration = {
  [key: string]: any;
};

interface RestApiConfigurationProps {
  onRefreshParent?: () => void;
}

export default function RestApiConfiguration({ onRefreshParent }: RestApiConfigurationProps) {
    const apiUrl = async (path: string) => `${await getApiUrl(window.location.hostname, window.location.protocol)}${path}`;
    const [loadedRestApiConfig, setLoadedRestApiConfig] = useState<Configuration>({});
    const [restApiConfig, setRestApiConfig] = useState<Configuration>({});
    const [disabledSave, setDisabledSave] = useState(true);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setDisabledSave(JSON.stringify(restApiConfig) === JSON.stringify(loadedRestApiConfig));
    }, [restApiConfig, loadedRestApiConfig]);
    const getRestApi = async () => {
        const response = await getRestApiConfig();
        if (response.REST_API_SELECTION === "remote" && response.REST_API_URL && response.REST_API_URL.trim() !== "") {
            return { "rest_api_selection": response.REST_API_SELECTION, "rest_api_url": response.REST_API_URL, "rest_api_url_port": response.REST_API_URL_PORT || 7000 };
        }
        else{
            return { "rest_api_selection": "local", "rest_api_url": `${await getApiUrl(window.location.hostname, window.location.protocol)}`, "rest_api_url_port": response.REST_API_URL_PORT || 7000 };
        }
    };

    const saveRestApi = async () => {
        try{
        setLoading(true);
        const { rest_api_selection: restapioption, rest_api_url: restapiurl, rest_api_url_port: restapiurlport } = restApiConfig;
        if(restapioption === "remote" && restapiurl && restapiurl.trim() !== ""){
            const respone = await saveRestApiConfig(restapioption, restapiurl, null);
            if (!respone.success) {
                throw new Error(respone.error || "Failed to save REST API configuration");
            }
        }
        else{
            const respone = await saveRestApiConfig(restapioption, null, restapiurlport);
            if (!respone.success) {
                throw new Error(respone.error || "Failed to save REST API configuration");
            }
        }
        if (onRefreshParent) {
            onRefreshParent();
        }
        toast.success("REST API configuration saved successfully");
        setLoadedRestApiConfig(restApiConfig);
    } catch (error) {
        console.error("Error saving REST API configuration:", error);
        toast.error("Error saving REST API configuration: " + (error instanceof Error ? error.message : ""));
    } finally {
        setLoading(false);
    }
    };

    const onUpdateRestApiConfig = async (newValue : string) => {
        console.log("Updating REST API configuration selection to:", restApiConfig);
            try{
                setLoading(true);
                const respone = await getRestApiConfig();
                if (newValue == "remote"){

                    setRestApiConfig({"rest_api_selection": newValue, "rest_api_url": respone.REST_API_URL, "rest_api_url_port": restApiConfig["rest_api_url_port"] });
                }
                else{
                    setRestApiConfig({"rest_api_selection": newValue, "rest_api_url": `${await getApiUrl(window.location.hostname, window.location.protocol,  restApiConfig["rest_api_url_port"])}`, "rest_api_url_port": restApiConfig["rest_api_url_port"] });
                }
            }
            catch(error){
                console.error("Error updating REST API configuration:", error);
                toast.error("Error updating REST API configuration: " + (error instanceof Error ? error.message : ""));
            }
            finally{
                setLoading(false);
            }
    }

    const onUpdateRestApiConfigPort = async (newValue : number) => {
        try{
            setLoading(true);
            const respone = await getRestApiConfig();
            setRestApiConfig({"rest_api_selection": "local", "rest_api_url": `${await getApiUrl(window.location.hostname, window.location.protocol, newValue)}`, "rest_api_url_port": newValue });
        }
        catch(error){
            console.error("Error updating REST API configuration port:", error);
            toast.error("Error updating REST API configuration port: " + (error instanceof Error ? error.message : ""));
        }
        finally{
            setLoading(false);
        }
    }

    useEffect(() => {
        const fetchRestApiConfig = async () => {
            setLoading(true);
            try{
                const restApiConfig = await getRestApi();
                setLoadedRestApiConfig(restApiConfig);
                setRestApiConfig(restApiConfig);
            }
            catch(error){
                console.error("Error fetching REST API configuration:", error);
                toast.error("Error fetching REST API configuration: " + (error instanceof Error ? error.message : ""));
            }
            finally{
                setLoading(false);
            }
        }
        fetchRestApiConfig();
    }, []);

    return (
         <div className="relative mt-4 flex flex-col">
            <OptionType typeKey="rest_api_selection" value={restApiConfig?.rest_api_selection || "local"} type="<dropdown>" options={[{key: "local", value: "Local"}, {key: "remote", value: "Remote" }] } onChange={async (newValue) => {await onUpdateRestApiConfig(newValue); setRestApiConfig((prev) => ({ ...prev, "rest_api_selection": newValue } ))}} />
            <OptionType min={1} max={65535} allHidden={restApiConfig["rest_api_selection"] === "remote"} typeKey="rest_api_url_port" value={restApiConfig["rest_api_url_port"] || 1} type="<number>" onChange={async (newValue) => {await onUpdateRestApiConfigPort(newValue); setRestApiConfig((prev) => ({ ...prev, "rest_api_url_port": newValue }))}} />
            <OptionType disabled={restApiConfig["rest_api_selection"] !== "remote"} typeKey="rest_api_url" value={restApiConfig["rest_api_url"] || ""} type="<string>" onChange={(newValue) => setRestApiConfig((prev) => ({ ...prev, "rest_api_url": newValue }))} />
        <div className="flex justify-end">
                <button onClick={saveRestApi} disabled={disabledSave} className="bg-blue-700 cursor-pointer enabled:hover:bg-blue-900 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed">Save</button>
            </div>
        {loading && (
            <ComponentLoader  name="REST API Configuration"/>
        ) }
        </div>
    );
}