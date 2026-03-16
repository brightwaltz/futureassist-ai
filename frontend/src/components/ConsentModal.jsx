import React, { useState } from "react";

/**
 * Privacy consent modal.
 * Must be shown before any data collection or HEROIC sharing.
 */
export default function ConsentModal({ onAccept, onDecline }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">
            プライバシーポリシーへの同意
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            未来アシストAI をご利用いただくにあたり、
            以下のプライバシーポリシーをご確認ください。
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 space-y-3">
            <h3 className="font-semibold text-gray-900">データの収集と利用</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>対話内容は、サービス改善と研究目的で匿名化して利用します</li>
              <li>アンケート回答は、ライフアビリティ評価の算出に使用します</li>
              <li>行動データ（利用頻度等）は、サービス品質の向上に使用します</li>
            </ul>

            <h3 className="font-semibold text-gray-900 pt-2">
              HEROIC データ共有
            </h3>
            <p className="text-gray-600">
              データはHEROICにおいて収集・解析後、共同研究機関（大学）に
              暗号化形式で提供します。個人を特定できる情報は含まれません。
            </p>

            {isExpanded && (
              <>
                <h3 className="font-semibold text-gray-900 pt-2">
                  データの保護
                </h3>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li>すべてのデータはAES-256暗号化で保護されます</li>
                  <li>個人情報保護法（APPI）に準拠して管理します</li>
                  <li>大学IRBの承認を得た研究目的にのみ使用します</li>
                </ul>

                <h3 className="font-semibold text-gray-900 pt-2">
                  同意の撤回
                </h3>
                <p className="text-gray-600">
                  同意はいつでも撤回できます。撤回後、未送信のデータは削除されます。
                  ただし、既に匿名化・解析済みのデータは削除できない場合があります。
                </p>

                <h3 className="font-semibold text-gray-900 pt-2">
                  お問い合わせ
                </h3>
                <p className="text-gray-600">
                  データの取り扱いに関するお問い合わせは、
                  柴田研究室（Service Informatics Lab, 玉川大学）までご連絡ください。
                </p>
              </>
            )}
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            {isExpanded ? "閉じる" : "詳細を表示..."}
          </button>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button
            onClick={onDecline}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
          >
            同意しない
          </button>
          <button
            onClick={() => onAccept("1.0")}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition"
          >
            同意する
          </button>
        </div>
      </div>
    </div>
  );
}
