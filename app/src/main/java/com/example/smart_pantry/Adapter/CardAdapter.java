package com.example.smart_pantry.Adapter;

import android.content.Context;
import android.content.Intent;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.cardview.widget.CardView;
import androidx.recyclerview.widget.RecyclerView;

import com.example.smart_pantry.DetailedRecipe;
import com.example.smart_pantry.R;
import com.example.smart_pantry.model.Card;
import com.squareup.picasso.Picasso;

import java.util.List;

public class CardAdapter extends RecyclerView.Adapter<CardAdapter.ViewHolder> {
    private Context context;
    private List<Card> cardItems;

    public CardAdapter(Context context, List<Card> cardItems) {
        this.context = context;
        this.cardItems = cardItems;
    }
    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.cardview_layout, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Card cardItem = cardItems.get(position);
        String imageUrl = cardItem.getImageResource();

        Picasso.get().load(imageUrl).into(holder.imageView);
        holder.textTitle.setText(cardItem.getTitle());
        holder.cardView.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                Context context = holder.itemView.getContext();
                Intent intent = new Intent(context, DetailedRecipe.class);
                intent.putExtra("recipe",cardItem.getRecipe());
                context.startActivity(intent);
            }
        });
    }


    @Override
    public int getItemCount() {
        return cardItems.size();
    }

    public static class ViewHolder extends RecyclerView.ViewHolder {
        ImageView imageView;
        TextView textTitle;
        CardView cardView;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            imageView = itemView.findViewById(R.id.imageView);
            textTitle = itemView.findViewById(R.id.textTitle);
            cardView = itemView.findViewById(R.id.cardView);
        }
    }
}
