"use client";

import * as React from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { BookListItem } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Video, ArrowRight, HelpCircle, Search, Building } from "lucide-react";

interface V2BooksHubProps {
  books: BookListItem[];
  locale: Locale;
}

function slugForLocale(book: BookListItem, locale: Locale): string {
  return locale === "en" ? book.slugEn : book.slugTr;
}

export function V2BooksHub({ books, locale }: V2BooksHubProps) {
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredBooks = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return books;
    return books.filter(
      (b) =>
        b.titleTr.toLowerCase().includes(q) ||
        b.publisherName.toLowerCase().includes(q) ||
        (b.examTrack && b.examTrack.toLowerCase().includes(q)),
    );
  }, [books, searchQuery]);

  return (
    <section aria-labelledby="v2-books-catalogue-heading" className="space-y-6">
      {/* SECTION HEADER WITH SEARCH */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm" icon={<BookOpen className="size-3.5" />}>
              Resmî Yayın Kataloğu
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">
              {books.length} Kayıtlı Yayın
            </span>
          </div>
          <h2
            id="v2-books-catalogue-heading"
            className="font-heading text-2xl sm:text-3xl font-bold text-foreground mt-1"
          >
            Video Çözümlü Coğrafya Deneme Kitapları
          </h2>
        </div>

        {/* Filter / Search Bar */}
        {books.length > 1 && (
          <div className="relative w-full sm:w-72">
            <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Kitap veya yayınevi ara..."
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 transition-all"
            />
          </div>
        )}
      </div>

      {/* BOOKS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredBooks.map((book) => {
          return (
            <Link
              key={book.slugTr}
              href={{
                pathname: "/v2/kitaplar/[slug]",
                params: { slug: slugForLocale(book, locale) },
              }}
              className="group relative flex flex-col sm:flex-row gap-6 p-6 rounded-3xl border border-border bg-card hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-0.5"
            >
              {/* Book Cover Image */}
              <div className="relative w-32 sm:w-36 aspect-[3/4] rounded-2xl overflow-hidden shadow-md border border-border/80 shrink-0 bg-muted group-hover:shadow-primary/20 transition-shadow">
                {book.coverImagePath ? (
                  <Image
                    src={book.coverImagePath}
                    alt={`${book.titleTr} kapak görseli`}
                    fill
                    sizes="(max-width: 40rem) 128px, 144px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-primary/10 via-card to-muted">
                    <BookOpen className="size-8 text-primary mb-2" />
                    <span className="text-[10px] font-bold text-foreground line-clamp-3">
                      {book.titleTr}
                    </span>
                  </div>
                )}
              </div>

              {/* Book Details */}
              <div className="flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="primary" size="sm">
                      {book.examTrack || "AYT / TYT"}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <Building className="size-3 text-muted-foreground/70" />
                      {book.publisherName}
                    </span>
                  </div>

                  <h3 className="font-heading text-lg sm:text-xl font-bold text-foreground group-hover:text-primary transition-colors leading-snug">
                    {book.titleTr}
                  </h3>
                </div>

                {/* Badges & Action Link */}
                <div className="space-y-4 pt-2 border-t border-border/60">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-semibold">
                      <Video className="size-3.5" />
                      {book.videoCount} Video Çözüm
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary/10 text-secondary font-semibold font-mono">
                      <HelpCircle className="size-3.5" />
                      {book.questionCount} Soru
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-semibold text-primary group-hover:translate-x-1 transition-transform">
                    <span>Video Çözüm Tezgâhına Git</span>
                    <ArrowRight className="size-4 ml-1" />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {filteredBooks.length === 0 && (
        <div className="p-12 text-center rounded-3xl border border-dashed border-border bg-card/50 space-y-3">
          <BookOpen className="size-10 text-muted-foreground mx-auto" />
          <h4 className="font-heading font-bold text-base text-foreground">
            Aramanızla eşleşen kitap bulunamadı
          </h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Farklı bir arama terimi deneyebilir veya arama filtresini temizleyebilirsiniz.
          </p>
          <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
            Aramayı Temizle
          </Button>
        </div>
      )}
    </section>
  );
}
