import { ChatWidget } from "@/components/chat/ChatWidget";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          customer-service-agent
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          右下角点击悬浮按钮打开“智能客服”聊天窗口（支持 Markdown、流式回复、👍👎反馈）。
        </p>
        <div className="mt-6 rounded-xl border bg-white p-6 text-sm shadow-sm dark:bg-zinc-950">
          <div className="font-medium">快速测试：</div>
          <ul className="mt-2 list-disc pl-5 text-muted-foreground">
            <li>问：“你们营业时间是什么”</li>
            <li>问：“怎么退款”</li>
            <li>问：“运费怎么算”</li>
            <li>问：“如何联系人工客服”</li>
          </ul>
        </div>
      </main>

      <ChatWidget />
    </div>
  );
}
