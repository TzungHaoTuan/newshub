export function ArticleRowSkeleton() {
  return (
    <div className="animate-pulse border-b border-rule px-4 py-4 sm:px-6">
      <div className="mb-1.5 flex items-center gap-2">
        <div className="h-[22px] w-14 rounded-sm bg-rule" />
        <div className="h-4 w-10 rounded-sm bg-rule" />
      </div>
      <div className="h-[24.75px] w-3/4 rounded-sm bg-rule" />
      <div className="mt-1 h-10 w-1/2 rounded-sm bg-rule" />
      <div className="mt-2 h-4 w-20 rounded-sm bg-rule" />
    </div>
  );
}
