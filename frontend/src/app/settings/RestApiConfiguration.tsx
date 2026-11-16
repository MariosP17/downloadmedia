"use client";

import { useState, useEffect } from "react";
import ComponentLoader from "../componentLoader";
import OptionType from "./OptionType";
import { toast } from "react-hot-toast";
import { getApiUrl,getRestApiConfig, saveRestApiConfig, getApiUrlForLocalSelection } from "../Actions/RestApiConfig";

export type Configuration = {
  [key: string]: any;
};

interface RestApiConfigurationProps {
  onApiReady?: () => void;
}

export default function RestApiConfiguration({ onApiReady }: RestApiConfigurationProps) {
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
            return { "rest_api_selection": response.REST_API_SELECTION, "rest_api_url": response.REST_API_URL, "rest_api_url_port": response.REST_API_URL_PORT || 7000, "rest_api_http_protocol": response.REST_API_HTTP_PROTOCOL || "http", "rest_api_service_name": response.REST_API_SERVICE_NAME || null };
        }
        else{
            return { "rest_api_selection": "local", "rest_api_url": `${await getApiUrl(window.location.hostname)}`, "rest_api_url_port": response.REST_API_URL_PORT || 7000, "rest_api_http_protocol": response.REST_API_HTTP_PROTOCOL || "http", "rest_api_service_name": response.REST_API_SERVICE_NAME || null };
        }
    };

    const saveRestApi = async () => {
        try{
        setLoading(true);
        const { rest_api_selection: restapioption, rest_api_url: restapiurl, rest_api_url_port: restapiurlport, rest_api_http_protocol: restapihttpprotocol, rest_api_service_name: restapiservicename } = restApiConfig;
        const apiUrl = restapioption === "remote" && restapiurl && restapiurl.trim() !== ""
            ? restapiurl.trim().replace(/\/+$/, "")
            : `${restapihttpprotocol}://${window.location.hostname}:${restapiurlport || 7000}`;
        const healthController = new AbortController();
        const healthTimeout = setTimeout(() => {
            healthController.abort();
        }, 2000);
        try {
            const healthResponse = await fetch(`${apiUrl}/health`, {
                signal: healthController.signal,
            });
            const healthBody = await healthResponse.text();
            if (!healthResponse.ok || healthBody !== "OK") {
                throw new Error(`API health check failed with status ${healthResponse.status}`);
            }
        }
        finally {
            clearTimeout(healthTimeout);
        }

        if(restapioption === "remote" && restapiurl && restapiurl.trim() !== ""){
            const respone = await saveRestApiConfig(restapioption, restapiurl, null, null, restapiservicename);
            if (!respone.success) {
                throw new Error(respone.error || "Failed to save REST API configuration");
            }
        }
        else{
            const respone = await saveRestApiConfig(restapioption, null, restapiurlport, restapihttpprotocol, restapiservicename);
            if (!respone.success) {
                throw new Error(respone.error || "Failed to save REST API configuration");
            }
        }
        onApiReady?.();
        toast.success("REST API configuration saved successfully");
        setLoadedRestApiConfig(restApiConfig);
    } catch (error) {
        console.error("Error saving REST API configuration:", error);
        toast.error("Could not connect to the API. Please check your REST API configuration.");
    } finally {
        setLoading(false);
    }
    };

    const onUpdateRestApiConfig = async (newValue : string) => {
            try{
                setLoading(true);
                const respone = await getRestApiConfig();
                if (newValue == "remote"){

                    setRestApiConfig({"rest_api_selection": newValue, "rest_api_url": respone.REST_API_URL, "rest_api_url_port": restApiConfig["rest_api_url_port"], "rest_api_http_protocol": restApiConfig["rest_api_http_protocol"], "rest_api_service_name": restApiConfig["rest_api_service_name"] });
                }
                else{
                    console.log("Updating REST API configuration to local with protocol:", restApiConfig["rest_api_http_protocol"], "and port:", restApiConfig["rest_api_url_port"], "and final url:", `${await getApiUrlForLocalSelection(window.location.hostname, restApiConfig["rest_api_url_port"], restApiConfig["rest_api_http_protocol"])}`);
                    setRestApiConfig({"rest_api_selection": newValue, "rest_api_url": `${await getApiUrlForLocalSelection(window.location.hostname, restApiConfig["rest_api_url_port"], restApiConfig["rest_api_http_protocol"])}`, "rest_api_url_port": restApiConfig["rest_api_url_port"], "rest_api_http_protocol": restApiConfig["rest_api_http_protocol"], "rest_api_service_name": restApiConfig["rest_api_service_name"] });
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

    const onUpdateRestApiConfigProtocol= async (newValue : string) => {
            try{
                setLoading(true);
                if (restApiConfig["rest_api_selection"] == "remote") return;
                setRestApiConfig({"rest_api_selection": restApiConfig["rest_api_selection"], "rest_api_url": `${await getApiUrlForLocalSelection(window.location.hostname,restApiConfig["rest_api_url_port"], newValue)}`, "rest_api_url_port": restApiConfig["rest_api_url_port"], "rest_api_http_protocol": newValue, "rest_api_service_name": restApiConfig["rest_api_service_name"] });
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
            setRestApiConfig({"rest_api_selection": "local", "rest_api_url": `${await getApiUrlForLocalSelection(window.location.hostname, newValue, restApiConfig["rest_api_http_protocol"])}`, "rest_api_url_port": newValue, "rest_api_http_protocol": restApiConfig["rest_api_http_protocol"], "rest_api_service_name": restApiConfig["rest_api_service_name"] });
        }
        catch(error){
            console.error("Error updating REST API configuration port:", error);
            toast.error("Error updating REST API configuration port: " + (error instanceof Error ? error.message : ""));
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
            {restApiConfig?.rest_api_selection === "local" && (
                <>
                <OptionType typeKey="rest_api_http_protocol" value={restApiConfig?.rest_api_http_protocol || "http"} type="<dropdown>" options={[{key: "http", value: "HTTP"}, {key: "https", value: "HTTPS" }] } onChange={async (newValue) => {await onUpdateRestApiConfigProtocol(newValue); setRestApiConfig((prev) => ({ ...prev, "rest_api_http_protocol": newValue } ))}} />
                <OptionType asNumber={true} typeKey="rest_api_url_port" value={restApiConfig["rest_api_url_port"] || ""} type="<string>" onChange={async (newValue) => {await onUpdateRestApiConfigPort(newValue); setRestApiConfig((prev) => ({ ...prev, "rest_api_url_port": parseInt(newValue) }))}} />
                </>
            )}
            <OptionType disabled={restApiConfig["rest_api_selection"] !== "remote"} typeKey="rest_api_url" value={restApiConfig["rest_api_url"] || ""} type="<string>" onChange={(newValue) => setRestApiConfig((prev) => ({ ...prev, "rest_api_url": newValue }))} />
            <OptionType typeKey="rest_api_service_name" value={restApiConfig["rest_api_service_name"] || ""} type="<string>" onChange={(newValue) => setRestApiConfig((prev) => ({ ...prev, "rest_api_service_name": newValue }))} />
            <div className="flex justify-end">
                <button onClick={saveRestApi} disabled={disabledSave} className="bg-blue-700 cursor-pointer enabled:hover:bg-blue-900 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed">Save</button>
            </div>
        {loading && (
            <ComponentLoader  name="REST API Configuration"/>
        ) }
        </div>
    );
}