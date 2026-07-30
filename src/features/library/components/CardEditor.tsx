import { useRef, useState } from "react";
import type { Card } from "../../../shared/library";
import { Modal } from "../../../shared/ui/Modal";
import { saveCard } from "../model/library.repository";

interface CardEditorProps {
  deckId: string;
  card?: Card;
  onClose: () => void;
}

export function CardEditor({ deckId, card, onClose }: CardEditorProps) {
  const [frontText, setFrontText] = useState(card?.frontText ?? "");
  const [backText, setBackText] = useState(card?.backText ?? "");
  const [extraSides, setExtraSides] = useState(card?.extraSides.map((side) => ({ ...side })) ?? []);
  const [image, setImage] = useState(card?.image ?? "");
  const [imageSide, setImageSide] = useState<"front" | "back">(card?.imageSide ?? "back");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Выберите файл изображения.");
      return;
    }
    if (file.size > 5_000_000) {
      setError("Изображение должно быть не больше 5 МБ.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await saveCard(deckId, { frontText, backText, extraSides, image, imageSide }, card?.id);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить карточку.");
    }
  };

  return (
    <Modal title={card ? "Редактировать карточку" : "Новая карточка"} onClose={onClose} wide>
      <form className="card-editor" onSubmit={submit}>
        <div className="card-editor-grid">
          <label>
            <span>Лицевая сторона</span>
            <textarea autoFocus value={frontText} onChange={(event) => setFrontText(event.target.value)} rows={5} />
          </label>
          <label>
            <span>Обратная сторона</span>
            <textarea value={backText} onChange={(event) => setBackText(event.target.value)} rows={5} />
          </label>
        </div>
        {extraSides.map((side, index) => (
          <label key={side.id || index}>
            <span>Дополнительная сторона {index + 1}</span>
            <div className="inline-input">
              <textarea
                value={side.text}
                onChange={(event) => setExtraSides((current) => current.map((item, itemIndex) => (
                  itemIndex === index ? { ...item, text: event.target.value } : item
                )))}
                rows={3}
              />
              <button className="secondary-action compact" type="button" onClick={() => setExtraSides((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Удалить</button>
            </div>
          </label>
        ))}
        <button className="secondary-action compact align-start" type="button" onClick={() => setExtraSides((current) => [...current, { id: "", text: "" }])}>
          + Дополнительная сторона
        </button>
        <div className="image-input-row">
          <input ref={fileRef} hidden type="file" accept="image/*" onChange={(event) => onFile(event.target.files?.[0])} />
          <button className="secondary-action" type="button" onClick={() => fileRef.current?.click()}>
            {image ? "Заменить изображение" : "Добавить изображение"}
          </button>
          {image && (
            <>
              <img className="card-image-preview" src={image} alt="Предпросмотр" />
              <label className="inline-select">
                <span>Показывать на</span>
                <select value={imageSide} onChange={(event) => setImageSide(event.target.value as "front" | "back")}>
                  <option value="front">лицевой</option>
                  <option value="back">обратной</option>
                </select>
              </label>
              <button className="text-action danger" type="button" onClick={() => setImage("")}>Убрать</button>
            </>
          )}
        </div>
        {error && <p className="form-error">{error}</p>}
        <footer className="form-actions">
          <button className="secondary-action" type="button" onClick={onClose}>Отмена</button>
          <button className="primary-action" type="submit">Сохранить карточку</button>
        </footer>
      </form>
    </Modal>
  );
}

