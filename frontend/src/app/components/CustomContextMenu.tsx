import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { getApiUrl } from '../Actions/RestApiConfig';
import { MediaType } from '../../../Props';

interface MenuState {
  x: number;
  y: number;
  isInSaved: boolean;
  type: MediaType;
  media: any; // Replace 'any' with the actual type of your episode object if available
  CloseMenu: () => void;
  ChangeMediaSavedStatus: (ttid: string, status: boolean, season: string) => void;
}

export default function CustomContextMenu({x, y, media, isInSaved, type, CloseMenu, ChangeMediaSavedStatus: ChangeMediaSavedStatus}: MenuState) {

  const handleAddToSaved = async (media : any) => {
    console.log('Adding to saved:', media, "with type:", type);
    const toastId = toast.loading(`Adding ${media.name || (type === MediaType.movie ? "movie" : media.id.split(':').length > 1 ? "episode" : "series")} to saved...`);
    try{
      const response = await fetch(await getApiUrl(window.location.hostname,window.location.protocol)+'/addSavedMedia', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ttid: media.id, type: type, name: media.name, poster_url: media.thumbnail || media.poster, year: media.released ? new Date(media.released).getFullYear() || 0 : parseInt(media.releaseInfo || '0'), series_name: media.series_name || null, episode_info: (media.season && media.episode) ? `S${media.season.toString().padStart(2, '0')}E${media.episode.toString().padStart(2, '0')}` : null })
      });
      if (!response.ok) {
        throw new Error((await response.json()).message || 'Failed to add to saved');
      }
      toast.success(`Added ${media.name || (type === MediaType.movie ? "movie" : media.id.split(':').length > 1 ? "episode" : "series")} to saved`, { id: toastId });
      window.dispatchEvent(new CustomEvent("saved-media-added", { detail: { ttid: media.id } }));
      ChangeMediaSavedStatus(media.id, true, media.season || -1);
    } catch (error) {
      console.error('Error adding to saved:', error);
      toast.error(`Failed to add ${media.name || (type === MediaType.movie ? "movie" : media.id.split(':').length > 1 ? "episode" : "series")} to saved: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: toastId });
    }
    CloseMenu();
  };

  const handleRemoveFromSaved = async (ttid: string) => {
    const toastId = toast.loading(`Removing ${media.name || (type === MediaType.movie ? "movie" : media.id.split(':').length > 1 ? "episode" : "series")} from saved...`);
    try{
      const response = await fetch(await getApiUrl(window.location.hostname,window.location.protocol)+'/deleteSavedMedia', {
        method: 'DELETE',
        body: new URLSearchParams({ ttid: ttid })
      });
      if (!response.ok) {
        throw new Error((await response.json()).message || 'Failed to remove from saved');
      }
      toast.success(`Removed ${media.name || (type === MediaType.movie ? "movie" : media.id.split(':').length > 1 ? "episode" : "series")} from saved`, { id: toastId });
      window.dispatchEvent(new CustomEvent("saved-media-deleted", { detail: { ttid: ttid } }));
      ChangeMediaSavedStatus(ttid, false, media.season || -1);
    } catch (error) {
      console.error('Error removing from saved:', error);
      toast.error(`Failed to remove ${media.name || (type === MediaType.movie ? "movie" : media.id.split(':').length > 1 ? "episode" : "series")} from saved: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: toastId });
    }
    CloseMenu();
  };

  return (
    <div className="fixed bg-transparent inset-0 z-60" onMouseDown={CloseMenu}>
        <div
            style={{
            top: y,
            left: x
            }}
            className="fixed z-61 bg-zinc-900 border border-zinc-700 rounded shadow-lg p-3 hover:cursor-pointer hover:bg-zinc-800 transition-colors"
            onClick={(e) => {
                e.preventDefault();
                if (isInSaved) {
                    handleRemoveFromSaved(media.id);
                } else {
                    handleAddToSaved(media);
                }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
        >
            <button 
            onMouseDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
            className='w-full  text-center bg-transparent border-none cursor-pointer hover:bg-zinc-800 transition-colors'
            >
            {isInSaved ? 'Remove from saved' : 'Add to saved'}
            </button>
        </div>
    </div>
  );
}