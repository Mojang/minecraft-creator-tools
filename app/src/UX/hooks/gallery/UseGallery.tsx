import { useEffect, useState } from "react";
import IGallery from "../../../app/IGallery";
import IGalleryItem, { GalleryItemType } from "../../../app/IGalleryItem";
import { useCreatorTools } from "../../contexts/creatorToolsContext/CreatorToolsContext";

type GalleryOptions = {
  query?: string | undefined;
  initialSize: number;
  pageSize: number;
  queryMinLength?: number;
  maxTemplates?: number | undefined;
  maxSnippets?: number | undefined;
};
export default function useGallery({ query, pageSize, ...options }: GalleryOptions) {
  const [creatorTools] = useCreatorTools();
  const [gallery, setGallery] = useState<IGallery>();

  //set maxes to undefined will allow unlimited results
  const [maxTemplates, setMaxTemplates] = useState<number | undefined>(options.initialSize);
  const [maxSnippets, setMaxSnippets] = useState<number | undefined>(options.initialSize);

  useEffect(() => {
    async function onLoad() {
      await creatorTools.load();

      const loadedGallery = await creatorTools.loadGallery();

      setGallery(loadedGallery);
    }

    onLoad();
  }, [creatorTools]);

  const queryMinLength = options.queryMinLength ?? 3;
  const useQuery = !!query && query.length >= queryMinLength;
  const filteredItems = gallery?.items.filter(
    (item) => !useQuery || item.title.toLowerCase().includes(query.toLowerCase())
  );

  const allTemplates = filteredItems?.filter(isTemplate) || [];
  const allSnippets = filteredItems?.filter(isSnippet) || [];

  const templates = allTemplates.slice(0, maxTemplates);
  const snippets = allSnippets.slice(0, maxSnippets);

  const fetchTemplates = () => setMaxTemplates((curr) => curr && curr + pageSize);
  const fetchSnippets = () => setMaxSnippets((curr) => curr && curr + pageSize);
  const isMoreTemplates = maxTemplates && templates.length < allTemplates.length;
  const isMoreSnippets = maxSnippets && snippets.length < allSnippets.length;

  return [templates, snippets, fetchTemplates, fetchSnippets, isMoreTemplates, isMoreSnippets, gallery] as const;
}

function isTemplate(item: IGalleryItem) {
  return (
    item.type === GalleryItemType.project ||
    item.type === GalleryItemType.editorProject ||
    item.type === GalleryItemType.blockType ||
    item.type === GalleryItemType.itemType
  );
}

function isSnippet(item: IGalleryItem) {
  return item.type === GalleryItemType.editorCodeSample || item.type === GalleryItemType.codeSample;
}
