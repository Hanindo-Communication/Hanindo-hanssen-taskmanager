import { BoardClient } from '@/components/board/board-client';
import { AppShell } from '@/components/dashboard/app-shell';
import { getBoardById } from '@/lib/utils/board';

type BoardPageProps = {
  params: Promise<{
    boardId: string;
  }>;
};

export default async function BoardPage({ params }: BoardPageProps) {
  const { boardId } = await params;
  const board = getBoardById(boardId);
  // #region agent log
  fetch('http://127.0.0.1:7751/ingest/9bcdc013-77cc-4766-ab50-abbe97a27379',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'39774b'},body:JSON.stringify({sessionId:'39774b',location:'app/boards/[boardId]/page.tsx',message:'BoardPage server',data:{boardId,hasInitialBoard:!!board,staticBoardId:board?.id},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
  // #endregion

  return (
    <AppShell activeBoardId={boardId}>
      <BoardClient initialBoard={board ?? null} boardId={boardId} />
    </AppShell>
  );
}
