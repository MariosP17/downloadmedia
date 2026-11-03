"use client";

import React, { useState ,useEffect} from 'react';
import Tree from 'rc-tree';
import 'rc-tree/assets/index.css';
import { toast } from 'react-hot-toast';
import { getApiUrl } from '../Actions/RestApiConfig';

// Define the shape of your folder data
interface TreeNode {
  key: string;
  title: string;
  isLeaf?: boolean;
  children?: TreeNode[];
}

interface FolderPickerProps {
  style?: React.CSSProperties;
  initialFolder: string;
  onSelectFolder?: (folderId: string) => void;
  folderName?: string;
}

function SwitcherIcon({ expanded, loading, isLeaf }: { expanded?: boolean; loading?: boolean; isLeaf?: boolean }) {
  if (isLeaf) {
    return <span className="folder-tree-switcher-placeholder" aria-hidden="true" />;
  }

  if (loading) {
    return (
      <span className="folder-tree-switcher-loader" aria-label="Loading">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <defs>
            <linearGradient id="folder-tree-loader-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="50%" stopColor="#a1a1aa" />
              <stop offset="100%" stopColor="#3f3f46" />
            </linearGradient>
          </defs>
          <circle cx="8" cy="8" r="5.5" stroke="url(#folder-tree-loader-gradient)" />
        </svg>
      </span>
    );
  }

  return (
    <span className="folder-tree-switcher-icon" aria-hidden="true">
      <svg viewBox="0 0 16 16">
        <path d={expanded ? "m4 6 4 4 4-4" : "m6 4 4 4-4 4"} />
      </svg>
    </span>
  );
}

export default function FolderPicker({ style,initialFolder, onSelectFolder, folderName }: FolderPickerProps) {
  // 1. Initial state: Just the root folder. isLeaf: false tells rc-tree it has children to load.
  const [treeData, setTreeData] = useState<TreeNode[]>([{
    key: "/",
    title: "/",
    isLeaf: false
  }]);
  
  const [selectedFolder, setSelectedFolder] = useState<string | null>(initialFolder);
  // const [displayedFolder, setDisplayedFolder] = useState<string | null>(initialFolder);
  const [treeOpen, setTreeOpen] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);

  const onExpand = (keys: React.Key[]) => {
    setExpandedKeys(keys);
  };
  // 2. The function to fetch subfolders from your remote API
  const fetchSubFolders = async (parentKey: string): Promise<TreeNode[]> => {
    try {
      const response = await fetch(`${await getApiUrl(window.location.hostname, window.location.protocol)}/getSuperFolderInfo`,{
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: parentKey }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch subfolders");
      
      // Map the API response to TreeNode format
      return data.folders.map((folder: { key: string; title: string; isLeaf: boolean }) => ({
        key: folder.key,
        title: folder.title,
        isLeaf: folder.isLeaf
      }));
    } catch (error) {
      console.error("Error fetching subfolders:", error);
      toast.error("Error fetching subfolders: " + (error instanceof Error ? error.message : ""));
      return [];
    }
  };

  // 3. Helper to update the tree state immutably when new data arrives
  const updateTreeData = (list: TreeNode[], key: React.Key, children: TreeNode[]): TreeNode[] => {
    return list.map((node) => {
      if (node.key === key) {
        return { ...node, children };
      }
      if (node.children) {
        return { ...node, children: updateTreeData(node.children, key, children) };
      }
      return node;
    });
  };

  // 4. Triggered when the user clicks the expand arrow
  const onLoadData = async (treeNode: any) => {
    const { key, children } = treeNode;
    
    // If children are already loaded, do nothing
    if (children) return;

    try {
      // Fetch children from server
      const newFolders = await fetchSubFolders(key);
      // Update state to render the new folders
      setTreeData((origin) => updateTreeData(origin, key, newFolders));
    } catch (error) {
      console.error("Failed to load folders", error);
      toast.error("Failed to load folders: " + (error instanceof Error ? error.message : ""));
    }
  };

  // 5. Triggered when the user clicks the folder name
  const onSelect = (selectedKeys: React.Key[], info: any) => {
    if (selectedKeys.length > 0) {
      if (selectedKeys[0] === "/") {
        selectedKeys = [];
        toast.error("Please select a valid folder, not the root folder.");
      }

      const folderId = selectedKeys[0] as string;
      // setDisplayedFolder(folderId);
      setSelectedFolder(folderId);
      // if (onSelectFolder) {
      //   onSelectFolder(selectedKeys[0] as string);
      // }
      // setTreeOpen(false); // Close the modal after selection
    }
  };

  const onOpenTreeModal = () => {
    setTreeOpen(true);
  };

  const onCloseTreeModal = (save: boolean = false) => {
    if (save){
      if (onSelectFolder && selectedFolder && selectedFolder !== initialFolder) {
        onSelectFolder(selectedFolder);
      }
    }
    else{
      setSelectedFolder(initialFolder);
    }
    setTreeOpen(false);
  };
  
  useEffect(() => {
    const loadInitialPath = async () => {
      if (!initialFolder) return;
      
    // setDisplayedFolder(initialFolder);
    setSelectedFolder(initialFolder);
    // Convert "/media/Movies/Action" into parent keys: ["/media", "/media/Movies"]
    const paths = initialFolder.split('/').slice(0, -1).filter(Boolean);
    const keysToExpand = paths.map((_, index) => 
        '/' + paths.slice(0, index + 1).join('/')
    );
    
    const allKeysToExpand = ['/', ...keysToExpand];

    // Start with a fresh root state
    let currentTree : TreeNode[] = [{ key: '/', title: '/', isLeaf: false }];
    // Sequentially fetch and build the tree data level-by-level
    for (const key of allKeysToExpand) {
      try {
        // Use your existing fetch logic here
        const newFolders = await fetchSubFolders(key); 
        
        // Use your existing updateTreeData helper to insert the new children
        currentTree = updateTreeData(currentTree, key, newFolders);
      } catch (error) {
        console.error(`Failed to load folder: ${key}`, error);
        break; // Stop trying to expand if a folder in the path is missing/fails
      }
    }

    // 1. First, provide the fully populated tree data
    setTreeData(currentTree);
    
    // 2. Now rc-tree can successfully expand all the way down
    setExpandedKeys(allKeysToExpand);
  };

  
  loadInitialPath();
}, [initialFolder]);

useEffect(() => {
  if (!treeOpen) return; // Only scroll when the tree is open
  const selectedSpan = document.querySelector(`.rc-tree-node-selected[title="${initialFolder.split('/').pop()}"]`);
  console.log("Scrolling to:", selectedSpan, "for folder:", initialFolder);
  if (selectedSpan) {
    selectedSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}, [treeOpen]);

  return (
    <div>
    <div style={style} className='cursor-pointer'>
      <input type="text" value={selectedFolder || ''} readOnly placeholder="Select a folder" className="w-full mb-2 p-2 border rounded"
        onClick={onOpenTreeModal} />
    </div>
    {treeOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => onCloseTreeModal()}>
			<div className="flex max-h-[75vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl p-4 border border-zinc-800 bg-zinc-900 shadow-2xl" onClick={(event) => event.stopPropagation()}>
				<div className="flex items-center justify-between border-b border-zinc-800 p-3">
          <h2 className="text-lg font-semibold text-zinc-100">Select {folderName}</h2>
          <button
            onClick={() => onCloseTreeModal()}
            className="text-zinc-400 hover:text-white font-bold cursor-pointer text-sm"
          >
            ✕
          </button>
        </div>
        <div className="flex-grow overflow-auto p-4 search-scrollbar border-b border-zinc-800 p-3">
        <Tree
          className="folder-picker-tree"
          treeData={treeData}
          loadData={onLoadData}
          onSelect={onSelect}
          selectedKeys={selectedFolder ? [selectedFolder] : []}
          expandedKeys={expandedKeys}       // ADDED: Controls what is expanded
          onExpand={onExpand}               // ADDED: Updates state when user clicks arrows
          autoExpandParent={true}           // ADDED: Ensures parent folders open automatically
          switcherIcon={SwitcherIcon}
        />
        </div>
        <div className="flex justify-end p-3">
          <button
            onClick={() => onCloseTreeModal(true)}
            disabled={!selectedFolder || selectedFolder === initialFolder}
            className="bg-blue-700 cursor-pointer enabled:hover:bg-blue-900 text-white font-bold py-1 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Choose
          </button>
        </div>
      </div>
    </div>
    )}
    </div>
  );
}