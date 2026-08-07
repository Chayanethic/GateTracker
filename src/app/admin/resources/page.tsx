'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import { 
  Wand2, Play, FileText, Database, Plus, ChevronDown, ChevronRight, 
  Activity, CheckCircle2, Image as ImageIcon, Folder, FolderOpen, X, 
  LayoutGrid, Link as LinkIcon, Clock, ListVideo, Trash2, Edit2, Save,
  Scissors, GripVertical
} from 'lucide-react';

type ResourceNode = any;
type HierarchyTree = Record<string, Record<string, ResourceNode[]>>;

export default function AdvancedResourceManager() {
  const [exam, setExam] = useState('GATE ECE');
  const [hierarchy, setHierarchy] = useState<HierarchyTree>({});
  const [isLoadingSystem, setIsLoadingSystem] = useState(true);
  
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const [isCreatingSubject, setIsCreatingSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [creatingTopicFor, setCreatingTopicFor] = useState<string | null>(null);
  const [newTopicName, setNewTopicName] = useState('');
  
  // DEPLOYMENT STATE
  const [uploadMode, setUploadMode] = useState<'single' | 'playlist'>('single');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState('video');
  const [duration, setDuration] = useState('');
  
  // PLAYLIST SLICER STATE
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  const [loading, setLoading] = useState(false);
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);
  const [thumbnailId, setThumbnailId] = useState<string | null>(null);

  // EDITING STATE
  const [editingNode, setEditingNode] = useState<{ id: string, type: 'subject' | 'topic' | 'video', oldVal: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  // DRAG & DROP STATE
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  useEffect(() => { fetchSystemData(); }, []);

  const fetchSystemData = async () => {
    setIsLoadingSystem(true);
    const { data: materials } = await supabase.from('study_materials').select('*').order('created_at', { ascending: false });
    if (materials) {
      const builtTree: HierarchyTree = {};
      materials.forEach(item => {
        if (!builtTree[item.subject_name]) builtTree[item.subject_name] = {};
        if (!builtTree[item.subject_name][item.topic_name]) builtTree[item.subject_name][item.topic_name] = [];
        builtTree[item.subject_name][item.topic_name].push(item);
      });
      setHierarchy(builtTree);
    }
    setIsLoadingSystem(false);
  };

  // --- CRUD: CREATE ---
  const handleCreateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    setHierarchy(prev => ({ ...prev, [newSubjectName.trim()]: {} }));
    setExpandedSubject(newSubjectName.trim());
    setIsCreatingSubject(false);
    setNewSubjectName('');
  };

  const handleCreateTopic = (e: React.FormEvent, subjectName: string) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;
    setHierarchy(prev => ({ ...prev, [subjectName]: { ...prev[subjectName], [newTopicName.trim()]: [] } }));
    setSelectedSubject(subjectName);
    setSelectedTopic(newTopicName.trim());
    setCreatingTopicFor(null);
    setNewTopicName('');
  };

  // --- CRUD: UPDATE ---
  const startEdit = (e: React.MouseEvent, type: 'subject'|'topic'|'video', oldVal: string, id: string = 'none') => {
    e.stopPropagation();
    setEditingNode({ id, type, oldVal });
    setEditValue(oldVal);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNode || !editValue.trim() || editValue === editingNode.oldVal) {
      setEditingNode(null); return;
    }
    
    const { type, oldVal, id } = editingNode;
    const newVal = editValue.trim();
    const toastId = toast.loading('Updating Database...');

    try {
      if (type === 'subject') {
        await supabase.from('study_materials').update({ subject_name: newVal }).eq('subject_name', oldVal);
        setHierarchy(prev => { const newTree = {...prev}; newTree[newVal] = newTree[oldVal]; delete newTree[oldVal]; return newTree; });
        if (selectedSubject === oldVal) setSelectedSubject(newVal);
        if (expandedSubject === oldVal) setExpandedSubject(newVal);
      } 
      else if (type === 'topic' && selectedSubject) {
        await supabase.from('study_materials').update({ topic_name: newVal }).eq('subject_name', selectedSubject).eq('topic_name', oldVal);
        setHierarchy(prev => { const newTree = {...prev}; newTree[selectedSubject][newVal] = newTree[selectedSubject][oldVal]; delete newTree[selectedSubject][oldVal]; return newTree; });
        if (selectedTopic === oldVal) setSelectedTopic(newVal);
      } 
      else if (type === 'video') {
        await supabase.from('study_materials').update({ title: newVal }).eq('id', id);
        setHierarchy(prev => {
          const newTree = {...prev};
          const targetArray = newTree[selectedSubject!][selectedTopic!];
          const index = targetArray.findIndex(v => v.id === id);
          if (index > -1) targetArray[index] = { ...targetArray[index], title: newVal };
          return newTree;
        });
      }
      toast.success('Updated Successfully', { id: toastId, style: { background: '#121214', color: '#10b981', border: '1px solid #059669' }});
    } catch (err) {
      toast.error('Update Failed', { id: toastId });
    }
    setEditingNode(null);
  };

  // --- CRUD: DELETE ---
  const handleDelete = async (e: React.MouseEvent, type: 'subject'|'topic'|'video', targetVal: string, id: string = 'none') => {
    e.stopPropagation();
    
    let confirmMsg = 'Are you sure? This cannot be undone.';
    if (type === 'subject') confirmMsg = `WARNING: Deleting '${targetVal}' will delete ALL topics and videos inside it!`;
    if (type === 'topic') confirmMsg = `WARNING: Deleting '${targetVal}' will delete ALL videos inside it!`;
    
    if (!window.confirm(confirmMsg)) return;

    const toastId = toast.loading('Deleting...');
    try {
      if (type === 'subject') {
        await supabase.from('study_materials').delete().eq('subject_name', targetVal);
        setHierarchy(prev => { const newTree = {...prev}; delete newTree[targetVal]; return newTree; });
        if (selectedSubject === targetVal) { setSelectedSubject(null); setSelectedTopic(null); }
      } 
      else if (type === 'topic' && selectedSubject) {
        await supabase.from('study_materials').delete().eq('subject_name', selectedSubject).eq('topic_name', targetVal);
        setHierarchy(prev => { const newTree = {...prev}; delete newTree[selectedSubject][targetVal]; return newTree; });
        if (selectedTopic === targetVal) setSelectedTopic(null);
      } 
      else if (type === 'video') {
        await supabase.from('study_materials').delete().eq('id', id);
        setHierarchy(prev => {
          const newTree = {...prev};
          newTree[selectedSubject!][selectedTopic!] = newTree[selectedSubject!][selectedTopic!].filter(v => v.id !== id);
          return newTree;
        });
      }
      toast.success('Deleted Successfully', { id: toastId, style: { background: '#121214', color: '#10b981', border: '1px solid #059669' }});
    } catch (err) {
      toast.error('Delete Failed', { id: toastId });
    }
  };

  // --- DRAG & DROP REORDER ---
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItemId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (id !== draggedItemId) setDragOverItemId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // required to allow dropping
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
    setDragOverItemId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!selectedSubject || !selectedTopic || !draggedItemId || draggedItemId === targetId) {
      setDraggedItemId(null); setDragOverItemId(null); return;
    }

    setHierarchy(prev => {
      const newTree = { ...prev };
      const list = [...newTree[selectedSubject][selectedTopic]];
      const fromIndex = list.findIndex(v => v.id === draggedItemId);
      const toIndex = list.findIndex(v => v.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;

      const [moved] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, moved);

      newTree[selectedSubject][selectedTopic] = list;
      return newTree;
    });

    setDraggedItemId(null);
    setDragOverItemId(null);
  };

  // --- YOUTUBE UTILS ---
  const parseISO8601Duration = (isoString: string) => {
    const match = isoString.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return '0:00';
    const h = parseInt(match[1]) || 0, m = parseInt(match[2]) || 0, s = parseInt(match[3]) || 0;
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
  };

  const extractPlaylistId = (link: string) => {
    const match = link.match(/[?&]list=([^#\&\?]+)/);
    return match ? match[1] : null;
  };

  useEffect(() => {
    if (uploadMode === 'playlist') return; 

    const fetchYoutubeData = async (videoId: string, rawUrl: string) => {
      setIsFetchingMeta(true);
      try {
        try {
          const noembedRes = await fetch(`https://noembed.com/embed?url=${rawUrl}`);
          const noembedData = await noembedRes.json();
          if (noembedData.title) {
            setTitle(prev => prev ? prev : noembedData.title); 
          }
        } catch (e) {}

        const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
        if (apiKey) {
          const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=${apiKey}`);
          const ytData = await ytRes.json();
          if (ytData.items?.length > 0) {
            setDuration(parseISO8601Duration(ytData.items[0].contentDetails.duration));
          }
        }
      } catch (err) {}
      setIsFetchingMeta(false);
    };

    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      setType('video');
      const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
      if (match && match[2].length === 11) {
        setThumbnailId(match[2]);
        fetchYoutubeData(match[2], url); 
      } else { setThumbnailId(null); }
    } else if (url.includes('.pdf')) { setType('pdf'); setThumbnailId(null); } 
    else { setThumbnailId(null); setType('link'); }
  }, [url, uploadMode]);

  // --- BATCH PLAYLIST UPLOAD (WITH SLICER) ---
  const handlePlaylistUpload = async () => {
    if (!selectedSubject || !selectedTopic || !url) return toast.error('Missing parameters.');
    const playlistId = extractPlaylistId(url);
    if (!playlistId) return toast.error('Invalid Playlist URL.');
    
    const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
    if (!apiKey) return toast.error('YouTube API Key Missing from .env');

    const startIdx = rangeStart ? Math.max(1, parseInt(rangeStart)) : 1;
    const endIdx = rangeEnd ? parseInt(rangeEnd) : 200; // Default max high enough for most playlists if left blank

    if (startIdx > endIdx) return toast.error('Start Video # cannot be greater than End Video #');

    setLoading(true);
    const toastId = toast.loading('Extracting Playlist Data...');
    
    try {
      // 1. Fetch Playlist Items with Pagination support to reach the 'endIdx'
      let allItems: any[] = [];
      let nextPageToken = '';
      
      while (allItems.length < endIdx) {
        const listRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${apiKey}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`);
        const listData = await listRes.json();
        
        if (!listData.items || listData.items.length === 0) break;
        
        allItems.push(...listData.items);
        nextPageToken = listData.nextPageToken;
        if (!nextPageToken) break; // Reached end of playlist
      }

      // 2. Slice the array exactly as the user requested
      const slicedItems = allItems.slice(startIdx - 1, endIdx);
      if (slicedItems.length === 0) throw new Error('No videos found in this specific range.');

      toast.loading(`Processing ${slicedItems.length} specific videos...`, { id: toastId });

      // 3. Extract IDs and Fetch Durations (Chunked to respect YouTube's 50 ID limit)
      const durationMap: Record<string, string> = {};
      
      for (let i = 0; i < slicedItems.length; i += 50) {
        const chunk = slicedItems.slice(i, i + 50);
        const videoIds = chunk.map((item: any) => item.snippet.resourceId.videoId).join(',');
        
        const vidRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${apiKey}`);
        const vidData = await vidRes.json();
        
        if (vidData.items) {
          vidData.items.forEach((v: any) => { 
            durationMap[v.id] = parseISO8601Duration(v.contentDetails.duration); 
          });
        }
      }

      // 4. Build the Final Payload
      const payload = slicedItems.map((item: any) => ({
        exam_name: exam,
        subject_name: selectedSubject,
        topic_name: selectedTopic,
        title: item.snippet.title,
        url: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
        resource_type: 'video',
        duration: durationMap[item.snippet.resourceId.videoId] || '0:00'
      })).filter((item:any) => item.title !== 'Private video' && item.title !== 'Deleted video');

      if (payload.length === 0) throw new Error('All selected videos were private or deleted.');

      toast.loading(`Deploying ${payload.length} records to DB...`, { id: toastId });
      const { data, error } = await supabase.from('study_materials').insert(payload).select();
      if (error) throw error;

      // 5. Update UI Optimistically
      setHierarchy(prev => {
        const updated = { ...prev };
        updated[selectedSubject][selectedTopic] = [...(data || []), ...(updated[selectedSubject][selectedTopic] || [])];
        return updated;
      });

      toast.success(`${payload.length} Videos Sliced & Deployed!`, { id: toastId, icon: '🚀', style: { background: '#121214', color: '#10b981', border: '1px solid #059669' } });
      setUrl('');
      setRangeStart('');
      setRangeEnd('');
    } catch (err: any) {
      toast.error(err.message || 'Playlist Sync Failed', { id: toastId, style: { background: '#121214', color: '#ef4444' } });
    }
    setLoading(false);
  };

  // --- SINGLE UPLOAD ---
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadMode === 'playlist') return handlePlaylistUpload();
    if (!selectedSubject || !selectedTopic || !title || !url) return toast.error('Missing payload parameters.');

    setLoading(true);
    
    const finalDuration = duration.trim() || '0:00';

    const newResource = { 
      exam_name: exam, 
      subject_name: selectedSubject, 
      topic_name: selectedTopic, 
      title: title.trim(), 
      url: url.trim(), 
      resource_type: type, 
      duration: finalDuration 
    };
    
    const { data, error } = await supabase.from('study_materials').insert([newResource]).select().single();

    if (error) {
      toast.error('Deployment Failed.', { style: { background: '#7f1d1d', color: '#fff' }});
      console.error(error);
    } else {
      toast.success('Resource Deployed!', { icon: '🚀', style: { background: '#18181b', color: '#10b981', border: '1px solid #059669' }});
      setHierarchy(prev => { const updated = { ...prev }; updated[selectedSubject][selectedTopic] = [data, ...(updated[selectedSubject][selectedTopic] || [])]; return updated; });
      setTitle(''); setUrl(''); setDuration(''); setThumbnailId(null);
    }
    setLoading(false);
  };

  const activeResources = useMemo(() => {
    if (!selectedSubject || !selectedTopic) return [];
    const rawList = hierarchy[selectedSubject]?.[selectedTopic] || [];
    const uniqueList = []; const seenIds = new Set();
    for (const item of rawList) { if (!seenIds.has(item.id)) { seenIds.add(item.id); uniqueList.push(item); } }
    return uniqueList;
  }, [hierarchy, selectedSubject, selectedTopic]);

  if (isLoadingSystem) return <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-zinc-500 text-xs font-bold tracking-widest uppercase animate-pulse">Initializing System...</div>;

  return (
    <div className="max-w-[1600px] mx-auto min-h-screen text-zinc-300 font-sans p-4 md:p-8 selection:bg-indigo-500/30">
      
      {/* HEADER */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-zinc-100 tracking-tight flex items-center gap-3 mb-2">
            <Database className="text-indigo-500" size={28} /> Resource Command Center
          </h1>
          <p className="text-zinc-500 text-sm">Interactive directory mapping, playlist automation, and fleet management.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT: DIRECTORY EXPLORER */}
        <div className="lg:col-span-4 bg-[#18181b] border border-zinc-800 rounded-2xl flex flex-col h-[calc(100vh-10rem)] shadow-xl overflow-hidden sticky top-8">
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center shrink-0">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Curriculum Directory</h2>
            <button onClick={() => setIsCreatingSubject(true)} className="p-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-md transition-colors"><Plus size={16} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-1">
            {isCreatingSubject && (
              <form onSubmit={handleCreateSubject} className="mb-2 p-2 bg-zinc-900 border border-indigo-500/30 rounded-lg flex items-center gap-2">
                <input autoFocus type="text" placeholder="Subject Name..." value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)} className="w-full bg-transparent text-sm text-zinc-100 outline-none" />
                <button type="button" onClick={() => setIsCreatingSubject(false)} className="text-zinc-500 hover:text-red-400"><X size={16}/></button>
                <button type="submit" className="text-indigo-400 font-medium text-xs bg-indigo-500/10 px-2 py-1 rounded">Save</button>
              </form>
            )}

            {Object.entries(hierarchy).map(([subjectName, topicsObj]) => {
              const isExpanded = expandedSubject === subjectName;
              const topics = Object.keys(topicsObj);
              
              return (
                <div key={subjectName} className="space-y-1">
                  <div className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${isExpanded ? 'bg-zinc-800/80' : 'hover:bg-zinc-900'}`} onClick={() => setExpandedSubject(isExpanded ? null : subjectName)}>
                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                      {isExpanded ? <FolderOpen size={16} className="text-indigo-400 shrink-0" /> : <Folder size={16} className="text-zinc-500 shrink-0" />}
                      
                      {/* INLINE SUBJECT EDIT */}
                      {editingNode?.type === 'subject' && editingNode.oldVal === subjectName ? (
                        <form onSubmit={submitEdit} className="flex-1 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} className="w-full bg-zinc-950 border border-indigo-500/50 rounded px-2 py-0.5 text-sm text-zinc-100 outline-none" />
                          <button type="submit" className="text-indigo-400"><Save size={14}/></button>
                          <button type="button" onClick={() => setEditingNode(null)} className="text-zinc-500"><X size={14}/></button>
                        </form>
                      ) : (
                        <span className={`text-sm truncate font-medium ${isExpanded ? 'text-zinc-100' : 'text-zinc-300'}`}>{subjectName}</span>
                      )}
                    </div>
                    
                    {/* ACTIONS */}
                    {editingNode?.oldVal !== subjectName && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => startEdit(e, 'subject', subjectName)} className="p-1 hover:bg-zinc-700 text-zinc-400 hover:text-indigo-400 rounded"><Edit2 size={12} /></button>
                        <button onClick={(e) => handleDelete(e, 'subject', subjectName)} className="p-1 hover:bg-zinc-700 text-zinc-400 hover:text-red-400 rounded"><Trash2 size={12} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setCreatingTopicFor(subjectName); setExpandedSubject(subjectName); }} className="p-1 hover:bg-zinc-700 text-zinc-400 hover:text-indigo-400 rounded"><Plus size={14} /></button>
                      </div>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="pl-7 pr-2 py-1 space-y-1 border-l border-zinc-800/50 ml-3.5">
                      {creatingTopicFor === subjectName && (
                        <form onSubmit={(e) => handleCreateTopic(e, subjectName)} className="flex items-center gap-2 p-1.5 bg-zinc-900 border border-indigo-500/30 rounded-md mb-2">
                          <input autoFocus type="text" placeholder="Topic Name..." value={newTopicName} onChange={e => setNewTopicName(e.target.value)} className="w-full bg-transparent text-xs text-zinc-100 outline-none" />
                          <button type="submit" className="text-indigo-400 font-medium text-[10px] bg-indigo-500/10 px-2 py-1 rounded">Save</button>
                        </form>
                      )}
                      
                      {topics.map(topicName => {
                        const isSelected = selectedSubject === subjectName && selectedTopic === topicName;
                        return (
                          <div key={topicName} onClick={() => { setSelectedSubject(subjectName); setSelectedTopic(topicName); }} className={`group flex items-center justify-between p-2 rounded-md cursor-pointer text-sm transition-all border ${isSelected ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 shadow-sm' : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}>
                            
                            {/* INLINE TOPIC EDIT */}
                            {editingNode?.type === 'topic' && editingNode.oldVal === topicName && selectedSubject === subjectName ? (
                              <form onSubmit={submitEdit} className="flex-1 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} className="w-full bg-zinc-950 border border-indigo-500/50 rounded px-2 py-0.5 text-xs text-zinc-100 outline-none" />
                                <button type="submit" className="text-indigo-400"><Save size={12}/></button>
                                <button type="button" onClick={() => setEditingNode(null)} className="text-zinc-500"><X size={12}/></button>
                              </form>
                            ) : (
                              <div className="flex items-center gap-2 truncate">
                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-indigo-400' : 'bg-zinc-700'}`}></div>
                                <span className="truncate">{topicName}</span>
                              </div>
                            )}

                            {/* TOPIC ACTIONS */}
                            {editingNode?.oldVal !== topicName && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => startEdit(e, 'topic', topicName)} className="p-1 hover:bg-zinc-700 hover:text-indigo-400 rounded text-zinc-500"><Edit2 size={12} /></button>
                                <button onClick={(e) => handleDelete(e, 'topic', topicName)} className="p-1 hover:bg-zinc-700 hover:text-red-400 rounded text-zinc-500"><Trash2 size={12} /></button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT: THE ACTIVE WORKSPACE */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {!selectedTopic ? (
            <div className="bg-[#18181b] border border-zinc-800 border-dashed rounded-2xl flex flex-col items-center justify-center h-[400px] text-center p-8">
              <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4"><LayoutGrid size={32} className="text-zinc-700" /></div>
              <h2 className="text-xl font-semibold text-zinc-300 mb-2">No Workspace Active</h2>
              <p className="text-zinc-500 text-sm max-w-sm">Select a topic from the curriculum directory on the left to view contents and deploy resources.</p>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* TARGET HEADER */}
              <div className="bg-gradient-to-r from-indigo-500/10 to-transparent border border-indigo-500/20 rounded-2xl p-6 flex justify-between items-center">
                <div>
                  <div className="text-[10px] font-bold text-indigo-400/80 uppercase tracking-widest mb-1">Active Payload Target</div>
                  <div className="flex items-center gap-2 text-xl font-semibold text-zinc-100">
                    <span className="text-zinc-400">{selectedSubject}</span>
                    <ChevronRight size={20} className="text-zinc-600" />
                    <span>{selectedTopic}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                
                {/* UPLOAD CONSOLE */}
                <form onSubmit={handleUpload} className="bg-[#18181b] border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col relative overflow-hidden h-[500px]">
                  
                  {isFetchingMeta && (
                    <div className="absolute inset-0 bg-[#18181b]/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                      <Activity className="animate-spin text-indigo-500 mb-2" size={24} />
                      <span className="text-xs font-bold text-zinc-300 uppercase tracking-widest">Extracting Metadata...</span>
                    </div>
                  )}

                  {/* MODE TABS */}
                  <div className="flex bg-zinc-900 p-1 rounded-lg mb-6 border border-zinc-800 shrink-0">
                    <button type="button" onClick={() => setUploadMode('single')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${uploadMode === 'single' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
                      <Play size={14}/> Single Media
                    </button>
                    <button type="button" onClick={() => setUploadMode('playlist')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${uploadMode === 'playlist' ? 'bg-indigo-500/20 text-indigo-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
                      <ListVideo size={14}/> Batch Playlist
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">{uploadMode === 'playlist' ? 'YouTube Playlist URL' : 'Resource URL'}</label>
                      <input required type="url" placeholder="https://youtube.com/..." value={url} onChange={(e) => setUrl(e.target.value)} className="w-full bg-[#09090b] border border-zinc-800 rounded-xl p-3.5 text-zinc-100 text-sm outline-none focus:border-indigo-500 transition-colors mb-4" />
                    </div>
                    
                    {uploadMode === 'single' ? (
                      <>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-2">
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Display Title</label>
                            <input required type="text" placeholder="e.g., Intro to Linear Algebra" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-[#09090b] border border-zinc-800 rounded-xl p-3.5 text-zinc-100 text-sm outline-none focus:border-indigo-500 transition-colors" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Duration</label>
                            <div className="relative">
                              <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                              <input type="text" placeholder="--:--" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full bg-[#09090b] border border-zinc-800 rounded-xl py-3.5 pl-8 pr-3 text-zinc-100 text-sm outline-none focus:border-indigo-500 transition-colors" />
                            </div>
                          </div>
                        </div>

                        {url && (
                          <div className="w-full h-24 bg-[#09090b] border border-zinc-800 rounded-xl overflow-hidden relative flex items-center justify-center mt-4">
                            {thumbnailId ? ( <img src={`https://img.youtube.com/vi/${thumbnailId}/maxresdefault.jpg`} alt="Preview" className="w-full h-full object-cover opacity-60" /> ) : (
                              <div className="text-zinc-600 flex gap-2 items-center text-xs font-bold uppercase tracking-wider">{type === 'pdf' ? <FileText size={16}/> : <LinkIcon size={16}/>} {type} Detected</div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-5 text-left mt-2">
                        <div className="flex items-center gap-3 mb-5 border-b border-indigo-500/10 pb-4">
                          <div className="p-2 bg-indigo-500/10 rounded-lg shrink-0"><Scissors size={20} className="text-indigo-400" /></div>
                          <div>
                            <h3 className="text-sm font-bold text-indigo-300 leading-none mb-1">Playlist Slicer</h3>
                            <p className="text-[10px] text-zinc-500">Deploy specific segments of a large playlist.</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                             <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Start Video #</label>
                             <input type="number" min="1" placeholder="1" value={rangeStart} onChange={e=>setRangeStart(e.target.value)} className="w-full bg-[#09090b] border border-indigo-500/20 rounded-xl p-3 text-indigo-100 text-sm outline-none focus:border-indigo-500 transition-colors" />
                          </div>
                          <div>
                             <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">End Video #</label>
                             <input type="number" min="1" placeholder="All" value={rangeEnd} onChange={e=>setRangeEnd(e.target.value)} className="w-full bg-[#09090b] border border-indigo-500/20 rounded-xl p-3 text-indigo-100 text-sm outline-none focus:border-indigo-500 transition-colors" />
                          </div>
                        </div>
                        <p className="text-[9px] text-zinc-600 mt-4 italic text-center">Leave inputs blank to deploy the entire playlist.</p>
                      </div>
                    )}
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading || isFetchingMeta} 
                    className={`w-full font-bold py-3.5 rounded-xl transition-all shrink-0 text-sm disabled:opacity-50 flex justify-center items-center gap-2 mt-4 ${uploadMode === 'playlist' ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]' : 'bg-zinc-100 hover:bg-white text-zinc-900 shadow-[0_0_20px_rgba(255,255,255,0.1)]'}`}
                  >
                    {loading ? <Activity className="animate-spin" size={18} /> : uploadMode === 'playlist' ? <Database size={18}/> : <Plus size={18} />}
                    {loading ? 'Transmitting...' : isFetchingMeta ? 'Extracting Data...' : uploadMode === 'playlist' ? 'Batch Sync Slice' : 'Confirm Deployment'}
                  </button>
                </form>

                {/* EXISTING RESOURCES IN TOPIC */}
                <div className="bg-[#18181b] border border-zinc-800 rounded-2xl flex flex-col shadow-xl h-[500px]">
                  <div className="p-5 border-b border-zinc-800 flex justify-between items-center shrink-0">
                    <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">Existing Assets</h2>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-zinc-600 italic hidden sm:inline">Drag to reorder</span>
                      <div className="bg-zinc-900 px-3 py-1 rounded-full text-[10px] font-bold text-zinc-400 uppercase tracking-widest border border-zinc-800">Count: {activeResources.length}</div>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                    {activeResources.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-3">
                        <FolderOpen size={32} className="opacity-50" />
                        <p className="text-xs font-medium uppercase tracking-widest">Folder is Empty</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activeResources.map((item: any) => (
                          <div 
                            key={item.id} 
                            draggable
                            onDragStart={(e) => handleDragStart(e, item.id)}
                            onDragEnter={(e) => handleDragEnter(e, item.id)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, item.id)}
                            onDragEnd={handleDragEnd}
                            className={`p-3 bg-zinc-900/50 hover:bg-zinc-800 rounded-xl transition-all flex items-start gap-3 group border
                              ${draggedItemId === item.id ? 'opacity-40 border-indigo-500/60 scale-[0.98]' : 'border-zinc-800/50 hover:border-zinc-700'}
                              ${dragOverItemId === item.id && draggedItemId !== item.id ? 'border-indigo-500 border-2 -translate-y-0.5 shadow-[0_0_15px_rgba(99,102,241,0.15)]' : ''}
                            `}
                          >
                            <div className="mt-1 text-zinc-700 group-hover:text-zinc-400 shrink-0 cursor-grab active:cursor-grabbing transition-colors">
                              <GripVertical size={14} />
                            </div>

                            <div className="mt-0.5 p-1.5 bg-zinc-900 rounded-md text-zinc-400 group-hover:text-indigo-400 transition-colors shadow-inner shrink-0">
                              {item.resource_type === 'video' ? <Play size={14} /> : <FileText size={14} />}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              {/* INLINE VIDEO EDIT */}
                              {editingNode?.type === 'video' && editingNode.id === item.id ? (
                                <form onSubmit={submitEdit} className="flex items-center gap-2 mb-1">
                                  <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} className="w-full bg-zinc-950 border border-indigo-500/50 rounded px-2 py-0.5 text-sm text-zinc-100 outline-none" />
                                  <button type="submit" className="text-indigo-400"><Save size={14}/></button>
                                  <button type="button" onClick={() => setEditingNode(null)} className="text-zinc-500"><X size={14}/></button>
                                </form>
                              ) : (
                                <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">{item.title}</p>
                              )}
                              
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] font-bold bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded uppercase tracking-widest">{item.resource_type}</span>
                                {item.duration && <span className="text-[9px] font-bold bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 px-1.5 py-0.5 rounded flex items-center gap-1"><Clock size={10}/> {item.duration}</span>}
                              </div>
                            </div>

                            {/* RESOURCE ACTIONS */}
                            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => startEdit(e, 'video', item.title, item.id)} className="p-1.5 hover:bg-zinc-700 text-zinc-500 hover:text-indigo-400 rounded"><Edit2 size={12}/></button>
                              <button onClick={(e) => handleDelete(e, 'video', item.title, item.id)} className="p-1.5 hover:bg-zinc-700 text-zinc-500 hover:text-red-400 rounded"><Trash2 size={12}/></button>
                            </div>

                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
